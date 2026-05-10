import { Command } from 'commander'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'
import { recordTestResult } from '../knowledge-writer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const KB_ROOT = join(__dirname, '../../../knowledge-base')

interface SuiteTest {
  id: string
  expression: string
  expect?: { ok?: boolean; type?: string }
  description?: string
}

interface Suite {
  name: string
  tests: SuiteTest[]
}

export const testSuiteCommand = new Command('test-suite')
  .description('Run a predefined test suite against Designer')
  .argument('<name>', 'Suite name (e.g., core)')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .action(async (name: string, opts: { host: string; port: string }) => {
    const suitePath = join(KB_ROOT, 'test-suites', `${name}.json`)
    let suiteRaw: string
    try {
      suiteRaw = await readFile(suitePath, 'utf-8')
    } catch {
      console.error(chalk.red(`Suite not found: ${suitePath}`))
      return
    }

    const suite: Suite = JSON.parse(suiteRaw)
    console.log(chalk.bold(`Running suite: ${suite.name}`))
    console.log()

    let passed = 0
    let failed = 0
    let errored = 0

    for (const test of suite.tests) {
      const script = `
import json as _json
import traceback as _traceback
try:
    _result = ${test.expression}
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

      if (result.status.code !== 0) {
        console.log(chalk.red('ERR'), chalk.white(test.id), chalk.gray(result.status.message))
        errored++
        await recordTestResult({
          expression: test.expression,
          result: { apiError: result.status.message },
          statusCode: result.status.code,
          d3Log: result.d3Log,
          pythonLog: result.pythonLog,
          timestamp: new Date().toISOString(),
          tag: `suite:${name}`,
        })
        continue
      }

      const parsed = parseReturnValue(result.returnValue) as Record<string, unknown> | null

      let pass = true
      if (test.expect) {
        if (test.expect.ok !== undefined && parsed && (parsed.ok as boolean) !== test.expect.ok) {
          pass = false
        }
        if (test.expect.type && parsed && (parsed.type as string) !== test.expect.type) {
          pass = false
        }
      } else if (parsed && parsed.ok === false) {
        pass = false
      }

      if (pass) {
        console.log(chalk.green('PASS'), chalk.white(test.id), chalk.gray(test.description ?? ''))
        passed++
      } else {
        const detail = parsed?.error ? `${parsed.errorType}: ${parsed.error}` : JSON.stringify(parsed)
        console.log(chalk.red('FAIL'), chalk.white(test.id), chalk.gray(detail))
        failed++
      }

      await recordTestResult({
        expression: test.expression,
        result: parsed,
        statusCode: result.status.code,
        d3Log: result.d3Log,
        pythonLog: result.pythonLog,
        timestamp: new Date().toISOString(),
        tag: `suite:${name}`,
      })
    }

    console.log()
    console.log(
      chalk.bold('Results:'),
      chalk.green(`${passed} passed`),
      failed > 0 ? chalk.red(`${failed} failed`) : '',
      errored > 0 ? chalk.yellow(`${errored} errors`) : ''
    )
  })
