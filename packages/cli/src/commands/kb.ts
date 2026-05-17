import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Command } from 'commander'
import chalk from 'chalk'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import { executePython, parseReturnValue } from '../designer-client.js'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../../..')
const CLI_PACKAGE_JSON = join(ROOT, 'packages', 'cli', 'package.json')
const DEFAULT_OUTPUT_DIR = join(ROOT, 'kb-submissions')

interface RedactionResult<T> {
  value: T
  count: number
  warnings: string[]
}

const REDACTION_RULES = [
  'windows_user_home',
  'windows_absolute_path',
  'unix_user_home',
  'unix_absolute_path',
  'email',
  'token_like_values',
]

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'probe'
}

function titleFromProbe(filePath: string, source: string): string {
  const firstComment = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('#') && !line.toLowerCase().startsWith('# run:'))

  if (firstComment) {
    return firstComment.replace(/^#+\s*/, '').replace(/\.$/, '')
  }

  return basename(filePath, '.py')
    .replace(/^probe[_-]/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function redactText(input: string): RedactionResult<string> {
  let count = 0
  let value = input
  const warnings: string[] = []

  const apply = (pattern: RegExp, replacement: string) => {
    value = value.replace(pattern, () => {
      count += 1
      return replacement
    })
  }

  apply(/\b[A-Z]:\\Users\\[^\\\s"'<>]+/gi, '<USER_HOME>')
  apply(/\b[A-Z]:\\(?:[^\\\r\n"'<>]+\\)+[^\\\r\n"'<>]*/gi, '<LOCAL_PATH>')
  apply(/\/Users\/[^/\s"'<>]+/g, '<USER_HOME>')
  apply(/\/home\/[^/\s"'<>]+/g, '<USER_HOME>')
  apply(/(?:\/[^/\s"'<>]+){3,}/g, '<LOCAL_PATH>')
  apply(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '<EMAIL>')
  apply(/\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?[^"',\s}]+/gi, '<SECRET>')

  if (/(client|customer|confidential)/i.test(input)) {
    warnings.push('possible_sensitive_name')
  }

  return { value, count, warnings }
}

function redactValue<T>(input: T): RedactionResult<T> {
  if (typeof input === 'string') {
    return redactText(input) as RedactionResult<T>
  }

  if (Array.isArray(input)) {
    let count = 0
    const warnings = new Set<string>()
    const value = input.map((item) => {
      const redacted = redactValue(item)
      count += redacted.count
      redacted.warnings.forEach((warning) => warnings.add(warning))
      return redacted.value
    }) as T
    return { value, count, warnings: [...warnings] }
  }

  if (input && typeof input === 'object') {
    let count = 0
    const warnings = new Set<string>()
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
      const redacted = redactValue(item)
      count += redacted.count
      redacted.warnings.forEach((warning) => warnings.add(warning))
      output[key] = redacted.value
    }
    return { value: output as T, count, warnings: [...warnings] }
  }

  return { value: input, count: 0, warnings: [] }
}

async function getCliVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(CLI_PACKAGE_JSON, 'utf8')) as { version?: string }
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

async function getGitCommit(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: ROOT,
      timeout: 5000,
    })
    return stdout.trim()
  } catch {
    return 'unknown'
  }
}

async function captureDesignerEnvironment(opts: { host: string; port: number }) {
  const script = `
import json as _json
_env = {}
try:
    _env["majorVersion"] = str(d3.majorVersion)
    _env["minorVersion"] = str(d3.minorVersion)
except:
    _env["designerVersion"] = "unknown"
try:
    _env["availableTypes"] = [name for name in ["Track", "Layer", "VideoClip", "FeedRect", "OscDevice", "TransportManager"] if hasattr(d3, name)]
except:
    _env["availableTypes"] = []
return _json.dumps(_env)
`

  const response = await executePython(script, opts)
  if (response.status.code !== 0) {
    return { error: response.status.message }
  }
  return parseReturnValue(response.returnValue) || {}
}

function proposedMarkdown(title: string, probeId: string, status: string, result: unknown): string {
  const resultText = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  const clipped = resultText.length > 2000 ? `${resultText.slice(0, 2000)}\n...` : resultText

  return `# ${title}

## Community Probe Result

Probe ID: \`${probeId}\`

Status: \`${status}\`

## Observed Result

\`\`\`json
${clipped}
\`\`\`

## Maintainer Notes

Review this submission, rewrite any accepted facts into the canonical KB style,
and promote only the distilled pattern, bug, or API note.
`
}

const submitProbeCommand = new Command('submit-probe')
  .description('Run a local Python probe and package one JSON payload for Hive School KB submission')
  .argument('<probeFile>', 'Path to a .py probe file')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--out-dir <dir>', 'Directory for the generated JSON payload', DEFAULT_OUTPUT_DIR)
  .option('--title <title>', 'Human-readable submission title')
  .option('--api <api>', 'API or behavior tested. Repeat for multiple APIs.', (value, previous: string[] = []) => {
    previous.push(value)
    return previous
  }, [])
  .option('--entry-type <type>', 'Suggested KB entry type: pattern, bug, api, or unknown', 'unknown')
  .option('--summary <summary>', 'Short maintainer-facing summary')
  .action(async (probeFile: string, opts: {
    host: string
    port: string
    outDir: string
    title?: string
    api: string[]
    entryType: string
    summary?: string
  }) => {
    const resolvedProbe = resolve(probeFile)
    if (!resolvedProbe.endsWith('.py')) {
      console.error(chalk.red('Only .py probe files can be packaged for KB submission.'))
      process.exitCode = 1
      return
    }

    if (!['pattern', 'bug', 'api', 'unknown'].includes(opts.entryType)) {
      console.error(chalk.red('--entry-type must be one of: pattern, bug, api, unknown'))
      process.exitCode = 1
      return
    }

    const port = parseInt(opts.port, 10)
    if (!Number.isFinite(port) || port <= 0) {
      console.error(chalk.red('--port must be a positive number'))
      process.exitCode = 1
      return
    }

    const source = await readFile(resolvedProbe, 'utf8')
    if (source.includes('\0')) {
      console.error(chalk.red('Probe file appears to contain binary data.'))
      process.exitCode = 1
      return
    }

    const probeTitle = opts.title || titleFromProbe(resolvedProbe, source)
    const probeId = slugify(basename(resolvedProbe, '.py'))
    const startedAt = new Date()

    console.log(chalk.cyan(`Running probe: ${probeTitle}`))
    const [environment, cliVersion, repoCommit] = await Promise.all([
      captureDesignerEnvironment({ host: opts.host, port }),
      getCliVersion(),
      getGitCommit(),
    ])

    const response = await executePython(source, { host: opts.host, port })
    const completedAt = new Date()
    const parsedReturn = parseReturnValue(response.returnValue)
    const status = response.status.code === 0 ? 'completed' : 'api-error'

    const redactedReturn = redactValue(parsedReturn)
    const redactedPythonLog = redactValue(response.pythonLog)
    const redactedD3Log = redactValue(response.d3Log)
    const redactedStatus = redactValue(response.status)
    const redactedEnvironment = redactValue(environment)

    const redactionCount =
      redactedReturn.count +
      redactedPythonLog.count +
      redactedD3Log.count +
      redactedStatus.count +
      redactedEnvironment.count

    const redactionWarnings = [
      ...new Set([
        ...redactedReturn.warnings,
        ...redactedPythonLog.warnings,
        ...redactedD3Log.warnings,
        ...redactedStatus.warnings,
        ...redactedEnvironment.warnings,
      ]),
    ]

    const createdAt = completedAt.toISOString()
    const createdStamp = createdAt.replace(/\D/g, '')
    const payload = {
      schemaVersion: 1,
      kind: 'd3-toolkit-kb-submission',
      createdAt,
      submissionId: `${probeId}-${createdStamp}`,
      uploadDestination: {
        site: 'https://hiveschool.one',
        note: 'Upload this JSON through the Hive School KB submission page. The CLI intentionally does not auto-upload.',
      },
      toolkit: {
        cliVersion,
        repoCommit,
      },
      environment: {
        os: process.platform,
        nodeVersion: process.version,
        designer: redactedEnvironment.value,
      },
      probe: {
        id: probeId,
        title: probeTitle,
        fileName: basename(resolvedProbe),
        relativePath: relative(ROOT, resolvedProbe).replace(/\\/g, '/'),
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        sourceIncluded: false,
        api: opts.api,
        suggestedEntryType: opts.entryType,
        startedAt: startedAt.toISOString(),
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status,
      },
      result: {
        statusCode: response.status.code,
        status: redactedStatus.value,
        returnValue: redactedReturn.value,
        pythonLog: redactedPythonLog.value,
        d3Log: redactedD3Log.value,
        summary: opts.summary || `${probeTitle} returned status ${response.status.code}.`,
      },
      proposedKbEntry: {
        type: opts.entryType,
        title: probeTitle,
        markdown: proposedMarkdown(probeTitle, probeId, status, redactedReturn.value),
      },
      redaction: {
        applied: true,
        rules: REDACTION_RULES,
        redactionCount,
        warnings: redactionWarnings,
      },
      consent: {
        collectedByWebsite: true,
        rightsConfirmed: false,
        publicContributionAccepted: false,
      },
    }

    const outputDir = resolve(opts.outDir)
    await mkdir(outputDir, { recursive: true })
    const outputPath = join(outputDir, `d3-kb-submission-${probeId}-${createdAt.slice(0, 10)}.json`)
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

    if (response.status.code === 0) {
      console.log(chalk.green('Probe completed.'))
    } else {
      console.log(chalk.yellow(`Probe returned Designer status ${response.status.code}: ${response.status.message}`))
    }
    console.log(chalk.gray(`Payload:`), outputPath)
    console.log(chalk.gray('Upload this single JSON file through Hive School. Review the preview before submitting.'))
  })

export const kbCommand = new Command('kb')
  .description('Knowledge base submission helpers')

kbCommand.addCommand(submitProbeCommand)
