import { Command } from 'commander'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KB_ROOT = join(__dirname, '../../../knowledge-base')
const CLAUDE_MD = join(__dirname, '../../../../CLAUDE.md')

interface LogEntry {
  type?: string // 'probe' for probe results
  expression?: string
  target?: string
  result?: Record<string, unknown>
  statusCode?: number
  timestamp?: string
  tag?: string
  typeName?: string
  attributes?: Array<{
    name: string
    type: string
    callable: boolean
    value?: string
    error?: string
  }>
}

async function readLog(): Promise<LogEntry[]> {
  const logPath = join(KB_ROOT, 'test-log.jsonl')
  let raw: string
  try {
    raw = await readFile(logPath, 'utf-8')
  } catch {
    return []
  }
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as LogEntry
      } catch {
        return null
      }
    })
    .filter((e): e is LogEntry => e !== null)
}

async function readIndex(): Promise<{ version: number; entries: Record<string, unknown>[] }> {
  const indexPath = join(KB_ROOT, 'api', 'index.json')
  try {
    return JSON.parse(await readFile(indexPath, 'utf-8'))
  } catch {
    return { version: 1, entries: [] }
  }
}

async function writeIndex(index: { version: number; entries: Record<string, unknown>[] }): Promise<void> {
  const indexPath = join(KB_ROOT, 'api', 'index.json')
  await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8')
}

interface FailurePattern {
  expression: string
  errorType: string
  error: string
  timestamp: string
}

interface ProbePattern {
  target: string
  typeName: string
  properties: string[]
  methods: string[]
  timestamp: string
}

function extractFailures(entries: LogEntry[]): FailurePattern[] {
  const failures: FailurePattern[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (entry.type === 'probe') continue
    const result = entry.result as Record<string, unknown> | null
    if (!result || result.ok !== false) continue
    if (!result.error || !result.errorType) continue

    const key = `${entry.expression}::${result.errorType}`
    if (seen.has(key)) continue
    seen.add(key)

    failures.push({
      expression: entry.expression || '',
      errorType: result.errorType as string,
      error: result.error as string,
      timestamp: entry.timestamp || '',
    })
  }
  return failures
}

function extractProbes(entries: LogEntry[]): ProbePattern[] {
  const probes: ProbePattern[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (entry.type !== 'probe') continue
    if (!entry.target || seen.has(entry.target)) continue
    seen.add(entry.target)

    const attrs = entry.attributes || []
    probes.push({
      target: entry.target,
      typeName: entry.typeName || 'unknown',
      properties: attrs.filter((a) => !a.callable && !a.error).map((a) => a.name),
      methods: attrs.filter((a) => a.callable && !a.error).map((a) => a.name),
      timestamp: entry.timestamp || '',
    })
  }
  return probes
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

async function generateBugDoc(failure: FailurePattern): Promise<{ slug: string; written: boolean }> {
  const slug = slugify(`${failure.errorType}-${failure.expression.slice(0, 40)}`)
  const filePath = join(KB_ROOT, 'bugs', `${slug}.md`)

  if (await fileExists(filePath)) {
    return { slug, written: false }
  }

  await mkdir(join(KB_ROOT, 'bugs'), { recursive: true })

  const content = `# ${failure.errorType}: ${failure.expression}

**Status**: CONFIRMED
**Tested**: ${failure.timestamp.slice(0, 10)}
**Severity**: ERROR

## Description

\`${failure.expression}\` throws \`${failure.errorType}\`.

## Error

\`\`\`
${failure.errorType}: ${failure.error}
\`\`\`

## Test Expression

\`\`\`python
${failure.expression}
\`\`\`

## Workaround

TODO: Document workaround if known.
`
  await writeFile(filePath, content, 'utf-8')
  return { slug, written: true }
}

async function generateTypeDoc(probe: ProbePattern): Promise<{ slug: string; written: boolean }> {
  const slug = slugify(probe.target)
  const filePath = join(KB_ROOT, 'types', `${slug}.md`)

  if (await fileExists(filePath)) {
    return { slug, written: false }
  }

  await mkdir(join(KB_ROOT, 'types'), { recursive: true })

  const propTable = probe.properties.length > 0
    ? probe.properties.map((p) => `| ${p} | UNTESTED |`).join('\n')
    : '| (none found) | |'

  const methodList = probe.methods.length > 0
    ? probe.methods.map((m) => `- \`${m}()\``).join('\n')
    : '- (none found)'

  const content = `# ${probe.target}

**Type**: ${probe.typeName}
**Probed**: ${probe.timestamp.slice(0, 10)}

## Properties

| Property | Status |
|----------|--------|
${propTable}

## Methods

${methodList}
`
  await writeFile(filePath, content, 'utf-8')
  return { slug, written: true }
}

async function appendToClaudeMd(newBugs: string[], newTypes: string[]): Promise<boolean> {
  if (newBugs.length === 0 && newTypes.length === 0) return false

  let content: string
  try {
    content = await readFile(CLAUDE_MD, 'utf-8')
  } catch {
    return false
  }

  let additions = ''

  if (newBugs.length > 0) {
    const bugLines = newBugs.map((b) => `- See \`bugs/${b}.md\``).join('\n')
    if (!content.includes('### Recently Discovered')) {
      additions += `\n### Recently Discovered\n${bugLines}\n`
    } else {
      // Append to existing section
      const marker = '### Recently Discovered'
      const idx = content.indexOf(marker)
      const afterMarker = idx + marker.length
      const nextSection = content.indexOf('\n### ', afterMarker + 1)
      const insertAt = nextSection === -1 ? content.length : nextSection
      content = content.slice(0, insertAt) + bugLines + '\n' + content.slice(insertAt)
      await writeFile(CLAUDE_MD, content, 'utf-8')
      return true
    }
  }

  if (newTypes.length > 0) {
    const typeLines = newTypes.map((t) => `- See \`types/${t}.md\``).join('\n')
    if (!content.includes('### Probed Types')) {
      additions += `\n### Probed Types\n${typeLines}\n`
    }
  }

  if (additions) {
    // Insert before ## Knowledge Base section
    const kbIdx = content.indexOf('## Knowledge Base')
    if (kbIdx !== -1) {
      content = content.slice(0, kbIdx) + additions + '\n' + content.slice(kbIdx)
    } else {
      content += additions
    }
    await writeFile(CLAUDE_MD, content, 'utf-8')
    return true
  }

  return false
}

async function updateIndex(
  index: { version: number; entries: Record<string, unknown>[] },
  newBugs: Array<{ slug: string }>,
  newTypes: Array<{ slug: string; probe: ProbePattern }>
): Promise<number> {
  let added = 0
  const existingFiles = new Set(index.entries.map((e) => e.file))

  for (const bug of newBugs) {
    const file = `bugs/${bug.slug}.md`
    if (existingFiles.has(file)) continue
    index.entries.push({
      bug: bug.slug,
      file,
      severity: 'error',
      tags: ['auto-discovered'],
      testedDate: new Date().toISOString().slice(0, 10),
    })
    added++
  }

  for (const type of newTypes) {
    const file = `types/${type.slug}.md`
    if (existingFiles.has(file)) continue
    index.entries.push({
      type: type.probe.target,
      file,
      status: 'probed',
      tags: ['auto-discovered'],
      testedDate: new Date().toISOString().slice(0, 10),
    })
    added++
  }

  if (added > 0) {
    await writeIndex(index)
  }
  return added
}

export const learnCommand = new Command('learn')
  .description('Process test-log.jsonl and promote findings to knowledge base')
  .option('--dry-run', 'Show what would be created without writing files', false)
  .action(async (opts: { dryRun: boolean }) => {
    const entries = await readLog()
    if (entries.length === 0) {
      console.log(chalk.yellow('No test log entries found. Run some d3 test or d3 probe commands first.'))
      return
    }

    console.log(chalk.cyan(`Processing ${entries.length} log entries...`))

    const failures = extractFailures(entries)
    const probes = extractProbes(entries)

    console.log(chalk.gray(`  Found ${failures.length} unique failures, ${probes.length} unique probes`))

    if (opts.dryRun) {
      if (failures.length > 0) {
        console.log(chalk.bold('\nWould create bug docs:'))
        for (const f of failures) {
          console.log(`  ${chalk.red(f.errorType)}: ${f.expression}`)
        }
      }
      if (probes.length > 0) {
        console.log(chalk.bold('\nWould create type docs:'))
        for (const p of probes) {
          console.log(`  ${chalk.green(p.target)} (${p.properties.length} props, ${p.methods.length} methods)`)
        }
      }
      return
    }

    const index = await readIndex()
    const createdBugs: Array<{ slug: string }> = []
    const createdTypes: Array<{ slug: string; probe: ProbePattern }> = []

    // Generate bug docs from failures
    for (const failure of failures) {
      const { slug, written } = await generateBugDoc(failure)
      if (written) {
        console.log(chalk.green(`  Created bugs/${slug}.md`))
        createdBugs.push({ slug })
      }
    }

    // Generate type docs from probes
    for (const probe of probes) {
      const { slug, written } = await generateTypeDoc(probe)
      if (written) {
        console.log(chalk.green(`  Created types/${slug}.md`))
        createdTypes.push({ slug, probe })
      }
    }

    // Update index.json
    const indexAdded = await updateIndex(index, createdBugs, createdTypes)
    if (indexAdded > 0) {
      console.log(chalk.green(`  Added ${indexAdded} entries to index.json`))
    }

    // Update CLAUDE.md
    const claudeUpdated = await appendToClaudeMd(
      createdBugs.map((b) => b.slug),
      createdTypes.map((t) => t.slug)
    )
    if (claudeUpdated) {
      console.log(chalk.green(`  Updated CLAUDE.md`))
    }

    const total = createdBugs.length + createdTypes.length
    if (total === 0) {
      console.log(chalk.gray('\nNo new findings to promote (all already documented).'))
    } else {
      console.log(chalk.bold.green(`\nPromoted ${total} findings to knowledge base.`))
    }
  })
