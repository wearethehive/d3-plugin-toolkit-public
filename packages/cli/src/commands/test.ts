import { Command } from 'commander'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'
import { recordTestResult } from '../knowledge-writer.js'

export const testCommand = new Command('test')
  .description('Test a Python expression and record the result')
  .argument('<expression>', 'Python expression to test')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--tag <tag>', 'Tag for knowledge base categorization')
  .action(async (expression: string, opts: { host: string; port: string; tag?: string }) => {
    const script = `
import json as _json
import traceback as _traceback
try:
    _result = ${expression}
    _type = type(_result).__name__
    _val = str(_result)
    if len(_val) > 500:
        _val = _val[:500] + '...'
    return _json.dumps({'ok': True, 'value': _val, 'type': _type})
except:
    return _json.dumps({'ok': False, 'error': _traceback.format_exc(), 'errorType': 'DesignerError'})
`

    const result = await executePython(script, {
      host: opts.host,
      port: parseInt(opts.port, 10),
    })

    const parsed = parseReturnValue(result.returnValue) as Record<string, unknown> | null

    if (result.status.code !== 0) {
      console.error(chalk.red('API Error:'), result.status.message)
      if (result.d3Log) console.log(chalk.gray('d3Log:'), result.d3Log)

      await recordTestResult({
        expression,
        result: { apiError: result.status.message },
        statusCode: result.status.code,
        d3Log: result.d3Log,
        pythonLog: result.pythonLog,
        timestamp: new Date().toISOString(),
        tag: opts.tag,
      })
      return
    }

    if (parsed && typeof parsed === 'object' && 'ok' in parsed) {
      if (parsed.ok) {
        console.log(chalk.green('PASS'), chalk.white(expression))
        console.log(chalk.gray('  Type:'), parsed.type)
        console.log(chalk.gray('  Value:'), parsed.value)
      } else {
        console.log(chalk.red('FAIL'), chalk.white(expression))
        console.log(chalk.red('  Error:'), `${parsed.errorType}: ${parsed.error}`)
      }
    } else {
      console.log(chalk.yellow('UNKNOWN'), chalk.white(expression))
      console.log(chalk.gray('  Raw:'), result.returnValue)
    }

    if (result.d3Log) {
      console.log(chalk.gray('  d3Log:'), result.d3Log)
    }

    await recordTestResult({
      expression,
      result: parsed,
      statusCode: result.status.code,
      d3Log: result.d3Log,
      pythonLog: result.pythonLog,
      timestamp: new Date().toISOString(),
      tag: opts.tag,
    })

    console.log(chalk.gray('  Recorded to knowledge base'))
  })
