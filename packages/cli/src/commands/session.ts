import { Command } from 'commander'
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KB_ROOT = join(__dirname, '../../../knowledge-base')

/**
 * Session captures the Designer environment state at a point in time.
 * Run `d3 session snapshot` before and after plugin work to track
 * what changed and capture the environment context for debugging.
 */

async function captureEnvironment(opts: { host: string; port: number }): Promise<Record<string, unknown>> {
  const script = `
import json as _json
import d3 as _d3

_env = {}

# Designer version
try:
    _env['majorVersion'] = d3.majorVersion
    _env['minorVersion'] = d3.minorVersion
except:
    _env['version'] = 'unknown'

# Project info
try:
    _env['projectFolder'] = str(d3.projectPaths.projectFolder)
    _env['projectName'] = str(d3.projectName)
except:
    _env['projectFolder'] = 'unknown'

# Track info
try:
    _track = guisystem.track
    _env['trackDescription'] = str(_track.description)
    _env['trackPath'] = str(_track.path)
    _env['layerCount'] = len(_track.layers)
    _env['playheadTime'] = trackTime()
except:
    _env['track'] = 'unavailable'

# Resource counts
_counts = {}
_types_to_check = [
    'VideoFile', 'VideoClip', 'Indirection', 'ListIndirectionController',
    'Track', 'Layer', 'Expression', 'LedScreen', 'Projector'
]
for _tn in _types_to_check:
    try:
        _cls = getattr(_d3, _tn, None)
        if _cls is not None:
            _res = resourceManager.allResources(_cls)
            _counts[_tn] = len(_res)
    except:
        pass
_env['resourceCounts'] = _counts

# Available d3 module types (spot-check for API changes)
_available = []
_check_types = [
    'Indirection', 'ListIndirectionController', 'VideoFile', 'VideoClip',
    'Track', 'Layer', 'KeySequence', 'KeyContainer', 'Expression',
    'Resource', 'ResourceManager', 'VariableVideoModule'
]
for _tn in _check_types:
    if hasattr(_d3, _tn):
        _available.append(_tn)
_env['availableTypes'] = _available

return _json.dumps(_env)
`
  const result = await executePython(script, opts)
  if (result.status.code !== 0) {
    return { error: result.status.message }
  }
  return (parseReturnValue(result.returnValue) as Record<string, unknown>) || {}
}

const snapshotCommand = new Command('snapshot')
  .description('Capture Designer environment state')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--label <label>', 'Label for this snapshot', '')
  .action(async (opts: { host: string; port: string; label: string }) => {
    console.log(chalk.cyan('Capturing environment snapshot...'))

    const env = await captureEnvironment({
      host: opts.host,
      port: parseInt(opts.port, 10),
    })

    const snapshot = {
      type: 'snapshot',
      label: opts.label || undefined,
      timestamp: new Date().toISOString(),
      environment: env,
    }

    // Append to session log
    const logPath = join(KB_ROOT, 'session-log.jsonl')
    await mkdir(dirname(logPath), { recursive: true })
    await appendFile(logPath, JSON.stringify(snapshot) + '\n', 'utf-8')

    // Display
    console.log(chalk.bold.white('\nDesigner Environment:'))
    if (env.majorVersion) {
      console.log(chalk.gray('  Version:'), `${env.majorVersion}.${env.minorVersion}`)
    }
    if (env.projectName) {
      console.log(chalk.gray('  Project:'), env.projectName)
    }
    if (env.trackDescription) {
      console.log(chalk.gray('  Track:'), env.trackDescription)
    }
    if (env.layerCount !== undefined) {
      console.log(chalk.gray('  Layers:'), env.layerCount)
    }

    const counts = env.resourceCounts as Record<string, number> | undefined
    if (counts && Object.keys(counts).length > 0) {
      console.log(chalk.bold.white('\nResource Counts:'))
      for (const [type, count] of Object.entries(counts)) {
        console.log(`  ${chalk.gray(type)}: ${count}`)
      }
    }

    const types = env.availableTypes as string[] | undefined
    if (types) {
      console.log(chalk.bold.white('\nAvailable Types:'), types.join(', '))
    }

    console.log(chalk.gray(`\nSaved to session-log.jsonl`))
  })

const diffCommand = new Command('diff')
  .description('Compare two snapshots to see what changed')
  .action(async () => {
    const logPath = join(KB_ROOT, 'session-log.jsonl')
    let raw: string
    try {
      raw = await readFile(logPath, 'utf-8')
    } catch {
      console.log(chalk.yellow('No session log found. Run d3 session snapshot first.'))
      return
    }

    const snapshots = raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try { return JSON.parse(l) } catch { return null }
      })
      .filter((s): s is Record<string, unknown> => s !== null && s.type === 'snapshot')

    if (snapshots.length < 2) {
      console.log(chalk.yellow('Need at least 2 snapshots to diff. Run d3 session snapshot again.'))
      return
    }

    const before = snapshots[snapshots.length - 2]
    const after = snapshots[snapshots.length - 1]
    const envBefore = before.environment as Record<string, unknown>
    const envAfter = after.environment as Record<string, unknown>

    console.log(chalk.bold.white('Session Diff'))
    console.log(chalk.gray(`  Before: ${before.timestamp}`))
    console.log(chalk.gray(`  After:  ${after.timestamp}`))
    console.log()

    // Compare resource counts
    const countsBefore = (envBefore.resourceCounts || {}) as Record<string, number>
    const countsAfter = (envAfter.resourceCounts || {}) as Record<string, number>
    const allTypes = new Set([...Object.keys(countsBefore), ...Object.keys(countsAfter)])

    let changes = 0
    for (const type of allTypes) {
      const b = countsBefore[type] ?? 0
      const a = countsAfter[type] ?? 0
      if (a !== b) {
        const delta = a - b
        const sign = delta > 0 ? '+' : ''
        const color = delta > 0 ? chalk.green : chalk.red
        console.log(`  ${type}: ${b} -> ${a} (${color(sign + delta)})`)
        changes++
      }
    }

    // Compare layer count
    const layersBefore = envBefore.layerCount as number | undefined
    const layersAfter = envAfter.layerCount as number | undefined
    if (layersBefore !== undefined && layersAfter !== undefined && layersBefore !== layersAfter) {
      const delta = (layersAfter ?? 0) - (layersBefore ?? 0)
      const sign = delta > 0 ? '+' : ''
      console.log(`  Layers: ${layersBefore} -> ${layersAfter} (${delta > 0 ? chalk.green(sign + delta) : chalk.red(sign + delta)})`)
      changes++
    }

    if (changes === 0) {
      console.log(chalk.gray('  No resource changes detected.'))
    }
  })

export const sessionCommand = new Command('session')
  .description('Capture and compare Designer environment state')

sessionCommand.addCommand(snapshotCommand)
sessionCommand.addCommand(diffCommand)
