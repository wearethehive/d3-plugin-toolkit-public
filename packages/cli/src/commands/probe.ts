import { Command } from 'commander'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'
import { recordProbeResult } from '../knowledge-writer.js'

export const probeCommand = new Command('probe')
  .description('Introspect a d3 type or object - list its attributes, types, and values')
  .argument('<target>', 'Type name (e.g., Indirection) or expression (e.g., guisystem.track)')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--all', 'Include private attributes (starting with _)', false)
  .option('--unsafe-dir', 'Use dir() on the target. This can crash Designer for some d3 objects.', false)
  .action(async (target: string, opts: { host: string; port: string; all: boolean; unsafeDir: boolean }) => {
    if (!opts.unsafeDir) {
      console.error(chalk.red('Refusing to run broad dir() probe without --unsafe-dir.'))
      console.error(chalk.gray('Use a focused reference-tool probe or pass --unsafe-dir for disposable sessions only.'))
      return
    }

    const includePrivate = opts.all ? 'True' : 'False'

    const script = `
import json as _json
import traceback as _traceback

_target = None
try:
    _target = getattr(d3, '${target}', None)
except:
    pass
if _target is None:
    try:
        _target = ${target}
    except:
        return _json.dumps({'error': 'Cannot resolve: ${target} (%s)' % _traceback.format_exc()})

_result = {
    'name': '${target}',
    'type': type(_target).__name__,
    'repr': str(_target)[:200],
    'attrs': []
}

for _attr in dir(_target):
    if not ${includePrivate} and _attr.startswith('_'):
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
    except:
        _info['error'] = _traceback.format_exc()
    _result['attrs'].append(_info)

return _json.dumps(_result)
`

    const result = await executePython(script, {
      host: opts.host,
      port: parseInt(opts.port, 10),
    })

    if (result.status.code !== 0) {
      console.error(chalk.red('API Error:'), result.status.message)
      return
    }

    const parsed = parseReturnValue(result.returnValue) as Record<string, unknown> | null
    if (!parsed || 'error' in parsed) {
      console.error(chalk.red('Error:'), parsed?.error ?? 'No response')
      return
    }

    console.log(chalk.bold.white(`${parsed.name}`), chalk.gray(`(${parsed.type})`))
    console.log(chalk.gray(`repr: ${parsed.repr}`))
    console.log()

    const attrs = parsed.attrs as Array<{
      name: string
      type: string
      callable: boolean
      value?: string
      error?: string
    }>

    const methods = attrs.filter((a) => a.callable && !a.error)
    const properties = attrs.filter((a) => !a.callable && !a.error)
    const errors = attrs.filter((a) => a.error)

    if (properties.length > 0) {
      console.log(chalk.bold.cyan('Properties:'))
      for (const attr of properties) {
        const val = attr.value !== undefined ? chalk.white(attr.value) : ''
        console.log(`  ${chalk.green(attr.name)} ${chalk.gray(`(${attr.type})`)} ${val}`)
      }
      console.log()
    }

    if (methods.length > 0) {
      console.log(chalk.bold.cyan('Methods:'))
      for (const attr of methods) {
        console.log(`  ${chalk.yellow(attr.name)}() ${chalk.gray(`(${attr.type})`)}`)
      }
      console.log()
    }

    if (errors.length > 0) {
      console.log(chalk.bold.red('Inaccessible:'))
      for (const attr of errors) {
        console.log(`  ${chalk.red(attr.name)} ${chalk.gray(attr.error ?? '')}`)
      }
      console.log()
    }

    console.log(chalk.gray(`Total: ${properties.length} properties, ${methods.length} methods, ${errors.length} errors`))

    await recordProbeResult({
      target,
      typeName: parsed.type as string,
      attributes: attrs,
      timestamp: new Date().toISOString(),
    })

    console.log(chalk.gray('Recorded to knowledge base'))
  })
