import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const config = JSON.parse(readFileSync(resolve(root, 'remote-plugin.config.json'), 'utf8'))
const host = config.host || '127.0.0.1'
const backendPort = Number(config.backendPort || 38301)
const pythonCmd = process.env.PYTHON || 'python'
const children = []

function start(label, command, args) {
  console.log(`[${label}] ${command} ${args.join(' ')}`)
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('publisher', pythonCmd, ['backend/publisher.py', '--port', String(backendPort)])
start('backend', 'node', ['backend/server.mjs', '--host', host, '--port', String(backendPort), '--static', 'frontend/dist'])
