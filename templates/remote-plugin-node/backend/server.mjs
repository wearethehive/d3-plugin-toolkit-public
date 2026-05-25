import { createReadStream, existsSync, readFileSync } from 'fs'
import { createServer } from 'http'
import { extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const config = JSON.parse(readFileSync(resolve(root, 'remote-plugin.config.json'), 'utf8'))

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1])
}

const host = args.get('--host') || config.host || '127.0.0.1'
const port = Number(args.get('--port') || config.backendPort || 38301)
const staticDir = args.has('--static') ? resolve(root, args.get('--static')) : null

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  })
  response.end(body)
}

async function checkDesigner(hostname, designerPort) {
  const url = `http://${hostname}:${designerPort}/api/session/python/execute`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: "return 'connected'" }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) {
      return { ok: false, host: hostname, port: designerPort, message: `${response.status} ${response.statusText}` }
    }
    const payload = await response.json()
    const status = payload.status || {}
    return {
      ok: status.code === 0,
      host: hostname,
      port: designerPort,
      message: status.message || (status.code === 0 ? 'connected' : 'unknown status'),
    }
  } catch (err) {
    return {
      ok: false,
      host: hostname,
      port: designerPort,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

function serveStatic(request, response) {
  if (!staticDir) {
    sendJson(response, 404, { ok: false, message: 'No static directory configured' })
    return
  }

  const url = new URL(request.url || '/', `http://${host}:${port}`)
  const relative = url.pathname.replace(/^\/+/, '') || 'index.html'
  let target = resolve(staticDir, relative)
  if (!target.startsWith(staticDir)) {
    sendJson(response, 400, { ok: false, message: 'Invalid path' })
    return
  }
  if (!existsSync(target)) target = join(staticDir, 'index.html')
  if (!existsSync(target)) {
    sendJson(response, 404, { ok: false, message: 'Static frontend not built' })
    return
  }
  response.writeHead(200, { 'Content-Type': contentTypes[extname(target)] || 'application/octet-stream' })
  createReadStream(target).pipe(response)
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    response.end()
    return
  }

  const url = new URL(request.url || '/', `http://${host}:${port}`)
  if (url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true, name: '{{pluginName}}', backend: 'node', version: '0.1.0' })
    return
  }

  if (url.pathname === '/api/designer/status') {
    const designerHost = url.searchParams.get('host') || config.designerHost || '127.0.0.1'
    const designerPort = Number(url.searchParams.get('port') || config.designerPort || 80)
    sendJson(response, 200, await checkDesigner(designerHost, designerPort))
    return
  }

  serveStatic(request, response)
})

server.listen(port, host, () => {
  console.log(`[remote-plugin] node backend listening on http://${host}:${port}`)
})

