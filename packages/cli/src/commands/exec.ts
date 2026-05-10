import { Command } from 'commander'
import { readFile } from 'fs/promises'
import chalk from 'chalk'
import { executePython, parseReturnValue } from '../designer-client.js'

export const execCommand = new Command('exec')
  .description('Execute raw Python on Designer')
  .argument('[script]', 'Python code to execute (or use --file)')
  .option('--file <path>', 'Read script from file')
  .option('--host <host>', 'Designer host', '127.0.0.1')
  .option('--port <port>', 'Designer port', '80')
  .option('--timeout <ms>', 'Request timeout in ms', '30000')
  .action(async (script: string | undefined, opts: { file?: string; host: string; port: string; timeout: string }) => {
    let code = script
    if (opts.file) {
      code = await readFile(opts.file, 'utf-8')
    }
    if (!code) {
      console.error(chalk.red('Error: provide a script argument or --file <path>'))
      return
    }

    const result = await executePython(code, {
      host: opts.host,
      port: parseInt(opts.port, 10),
      timeout: parseInt(opts.timeout, 10),
    })

    if (result.status.code === 0) {
      const value = parseReturnValue(result.returnValue)
      if (value !== null) {
        console.log(chalk.green('Return:'), typeof value === 'object' ? JSON.stringify(value, null, 2) : value)
      } else {
        console.log(chalk.green('OK'), chalk.gray('(no return value)'))
      }
    } else {
      console.error(chalk.red('Error:'), result.status.message)
    }

    if (result.d3Log) {
      console.log(chalk.gray('d3Log:'), result.d3Log)
    }
    if (result.pythonLog) {
      console.log(chalk.cyan('pyLog:'), result.pythonLog)
    }
  })
