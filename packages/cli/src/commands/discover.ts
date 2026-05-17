import { Command } from 'commander'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'
import { recordProbeResult } from '../knowledge-writer.js'

/**
 * Discover runs a deep probe: it introspects a type, then follows property types
 * to build a connected picture of the API surface. Results feed into `d3 learn`.
 */
export const discoverCommand = new Command('discover')
  .description('Deep-probe a d3 type - introspect it and test key operations')
  .argument('<type>', 'Type name (e.g., Indirection, ListIndirectionController)')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--depth <n>', 'How many levels of related types to probe', '1')
  .option('--unsafe-dir', 'Use dir() for broad type introspection. This can crash Designer for some d3 objects.', false)
  .action(async (typeName: string, opts: { host: string; port: string; depth: string; unsafeDir: boolean }) => {
    if (!opts.unsafeDir) {
      console.error(chalk.red('Refusing to run broad dir() discovery without --unsafe-dir.'))
      console.error(chalk.gray('Use focused reference-tool probes or pass --unsafe-dir for disposable sessions only.'))
      return
    }

    const execOpts = { host: opts.host, port: parseInt(opts.port, 10) }
    const maxDepth = parseInt(opts.depth, 10)
    const probed = new Set<string>()

    async function probeType(name: string, depth: number): Promise<void> {
      if (probed.has(name) || depth > maxDepth) return
      probed.add(name)

      console.log(chalk.cyan(`Probing ${name}...`))

      const script = `
import json as _json
import d3 as _d3
import traceback as _traceback

_target = getattr(_d3, '${name}', None)
if _target is None:
    return _json.dumps({'error': 'Type not found: ${name}'})

_result = {
    'name': '${name}',
    'type': type(_target).__name__,
    'repr': str(_target)[:200],
    'attrs': [],
    'bases': [],
    'related_types': []
}

try:
    for _b in _target.__mro__:
        _bn = _b.__name__
        if _bn not in ('object', 'type', '_BlipValue', 'instance'):
            _result['bases'].append(_bn)
except:
    pass

for _attr in dir(_target):
    if _attr.startswith('_'):
        continue
    _info = {'name': _attr}
    try:
        _val = getattr(_target, _attr)
        _info['type'] = type(_val).__name__
        _info['callable'] = callable(_val)
        if not callable(_val):
            _s = str(_val)
            if len(_s) > 100:
                _s = _s[:100] + '...'
            _info['value'] = _s
            _vtype = type(_val).__name__
            if _vtype not in ('str', 'int', 'float', 'bool', 'NoneType', 'property', 'type', 'list', 'dict', 'tuple'):
                if hasattr(_d3, _vtype):
                    _result['related_types'].append(_vtype)
    except:
        _info['error'] = _traceback.format_exc()
    _result['attrs'].append(_info)

return _json.dumps(_result)
`

      const response = await executePython(script, execOpts)
      if (response.status.code !== 0) {
        console.log(chalk.red(`  API error for ${name}: ${response.status.message}`))
        return
      }

      const parsed = parseReturnValue(response.returnValue) as Record<string, unknown> | null
      if (!parsed || 'error' in parsed) {
        console.log(chalk.red(`  ${parsed?.error ?? 'No response'}`))
        return
      }

      const attrs = (parsed.attrs as Array<{
        name: string; type: string; callable: boolean; value?: string; error?: string
      }>) || []
      const bases = (parsed.bases as string[]) || []
      const relatedTypes = (parsed.related_types as string[]) || []

      const properties = attrs.filter((a) => !a.callable && !a.error)
      const methods = attrs.filter((a) => a.callable && !a.error)
      const errors = attrs.filter((a) => a.error)

      console.log(chalk.bold.white(`  ${name}`), chalk.gray(`(${parsed.type})`))
      if (bases.length > 0) {
        console.log(chalk.gray(`  Inherits: ${bases.join(' -> ')}`))
      }
      console.log(chalk.gray(`  ${properties.length} properties, ${methods.length} methods, ${errors.length} errors`))

      await recordProbeResult({
        target: name,
        typeName: parsed.type as string,
        attributes: attrs,
        timestamp: new Date().toISOString(),
      })

      if (depth < maxDepth) {
        const toProbe = [...new Set([...bases, ...relatedTypes])].filter((t) => !probed.has(t))
        for (const related of toProbe) {
          await probeType(related, depth + 1)
        }
      }
    }

    await probeType(typeName, 0)

    console.log()
    console.log(chalk.gray(`Probed ${probed.size} types. Run ${chalk.white('d3 learn')} to promote findings.`))
  })
