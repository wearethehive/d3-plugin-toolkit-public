import { spawn } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const config = JSON.parse(readFileSync(resolve(root, 'remote-plugin.config.json'), 'utf8'))
const host = config.host || '127.0.0.1'
const frontendPort = Number(config.frontendPort || 5173)
const backendPort = Number(config.backendPort || 38301)

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const pythonCmd = process.env.PYTHON || 'python'
const children = []

function start(label, command, args, options = {}) {
  console.log(`[${label}] ${command} ${args.join(' ')}`)
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...options,
  })
  children.push(child)
  child.on('exit', (code) => {
    if (shuttingDown) return
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`)
      shutdown(code)
    }
  })
  return child
}

let shuttingDown = false
function shutdown(code = 0) {
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log(`Remote plugin dev for {{title}}`)
console.log(`Frontend: http://${host}:${frontendPort}`)
console.log(`Backend:  http://${host}:${backendPort}`)

start('backend', 'node', ['backend/server.mjs', '--host', host, '--port', String(backendPort)])
start('publisher', pythonCmd, ['backend/publisher.py', '--port', String(frontendPort)])
start('frontend', npmCmd, ['exec', 'vite', '--', '--config', 'frontend/vite.config.ts'], {
  env: {
    ...process.env,
    D3_REMOTE_FRONTEND_PORT: String(frontendPort),
    VITE_D3_REMOTE_BACKEND_URL: `http://${host}:${backendPort}`,
  },
})
