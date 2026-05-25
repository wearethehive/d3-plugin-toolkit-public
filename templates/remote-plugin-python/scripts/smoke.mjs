import { existsSync, readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
}

function check(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`)
    process.exitCode = 1
    return
  }
  console.log(`[OK] ${message}`)
}

const toolkit = readJson('d3-toolkit.plugin.json')
const d3plugin = readJson('d3plugin.json')
const config = readJson('remote-plugin.config.json')

check(toolkit.kind === 'remote', 'toolkit manifest kind is remote')
check(toolkit.backend === 'python', 'toolkit manifest backend is python')
check(Boolean(d3plugin.name), 'd3plugin.json has a name')
check(d3plugin.requiresSession === true || d3plugin.requiresSession === false, 'd3plugin.json has requiresSession')
check(config.backend === 'python', 'remote config backend is python')
check(Number.isFinite(Number(config.frontendPort)), 'frontend port is numeric')
check(Number.isFinite(Number(config.backendPort)), 'backend port is numeric')
check(existsSync(resolve(root, 'backend/app.py')), 'backend app exists')
check(existsSync(resolve(root, 'backend/publisher.py')), 'publisher exists')
check(existsSync(resolve(root, 'frontend/vite.config.ts')), 'frontend vite config exists')

if (process.argv.includes('--server')) {
  const response = await fetch(`http://${config.host || '127.0.0.1'}:${config.backendPort}/api/health`)
  check(response.ok, 'backend health endpoint responded')
}

if (process.argv.includes('--designer')) {
  const response = await fetch(`http://${config.host || '127.0.0.1'}:${config.backendPort}/api/designer/status`)
  const payload = await response.json()
  check(response.ok && payload.ok, `backend Designer status: ${payload.message || 'unknown'}`)
}

if (process.argv.includes('--dnssd')) {
  const result = checkDnssd(d3plugin, config)
  check(result.ok, result.message)
}

if (process.exitCode) {
  process.exit(process.exitCode)
}

function checkDnssd(d3plugin, config) {
  const python = process.env.PYTHON || 'python'
  const script = String.raw`
import json
import sys
import time

try:
    from zeroconf import ServiceBrowser, ServiceStateChange, Zeroconf
except Exception as exc:
    print(json.dumps({"ok": False, "message": "Python zeroconf is not installed: %s" % exc}))
    sys.exit(2)

target = sys.argv[1]
expected_port = int(sys.argv[2])
expected_session = sys.argv[3].lower()
found = []

def on_service_state_change(zeroconf, service_type, name, state_change):
    if state_change not in (ServiceStateChange.Added, ServiceStateChange.Updated):
        return
    info = zeroconf.get_service_info(service_type, name, timeout=3000)
    if not info:
        return
    properties = {}
    for key, value in info.properties.items():
        properties[key.decode("utf-8", "replace")] = value.decode("utf-8", "replace")
    found.append({
        "name": name,
        "port": info.port,
        "server": info.server,
        "properties": properties,
    })

zeroconf = Zeroconf()
browser = ServiceBrowser(zeroconf, "_d3plugin._tcp.local.", handlers=[on_service_state_change])
try:
    deadline = time.time() + 10
    while time.time() < deadline:
        if any(target in item["name"] for item in found):
            break
        time.sleep(0.25)
finally:
    zeroconf.close()

match = None
for item in found:
    if target in item["name"]:
        match = item
        break

if not match:
    print(json.dumps({"ok": False, "message": "DNS-SD service not found for %s" % target, "found": found}))
    sys.exit(1)

properties = match.get("properties", {})
ok = (
    match.get("port") == expected_port and
    properties.get("t") == "web" and
    properties.get("s") == expected_session
)
print(json.dumps({
    "ok": ok,
    "message": "DNS-SD service %s on port %s with TXT t=%s s=%s" % (
        match.get("name"),
        match.get("port"),
        properties.get("t"),
        properties.get("s"),
    ),
    "match": match,
}))
sys.exit(0 if ok else 1)
`
  const session = String(Boolean(d3plugin.requiresSession))
  const completed = spawnSync(python, ['-c', script, d3plugin.name, String(config.frontendPort), session], {
    cwd: root,
    encoding: 'utf8',
  })

  const raw = (completed.stdout || '').trim()
  if (!raw) {
    return {
      ok: false,
      message: `DNS-SD check failed: ${completed.stderr || `exit ${completed.status}`}`,
    }
  }

  try {
    const payload = JSON.parse(raw)
    return {
      ok: completed.status === 0 && Boolean(payload.ok),
      message: payload.message || raw,
    }
  } catch {
    return {
      ok: false,
      message: `DNS-SD check produced invalid JSON: ${raw}`,
    }
  }
}
