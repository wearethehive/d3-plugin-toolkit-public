---
type: pattern
status: confirmed
tested: "2026-05-19"
scope: remote-plugin
api_coverage:
  - name: "Remote plugin DNS-SD publishing"
    match: "DesignerPlugin\\.default_init|_d3plugin\\._tcp\\.local|remote smoke .*--dnssd"
    related_files: ["remote-plugin-dnssd-publishing.md"]
    required: false
---

# Remote Plugin DNS-SD Publishing

## Confirmed Pattern

Use the official Python `designer-plugin` package to publish remote Disguise
plugins via DNS-SD:

```python
from designer_plugin import DesignerPlugin

with DesignerPlugin.default_init(port=5173):
    input("Press Enter to stop")
```

`DesignerPlugin.default_init(port)` reads `./d3plugin.json` from the current
working directory. The current working directory must therefore be the remote
plugin root when starting the publisher.

## Service Record Shape

Live smoke test on 2026-05-19 confirmed this service record:

```json
{
  "name": "Remote DNS-SD Smoke._d3plugin._tcp.local.",
  "port": 5173,
  "server": "HIVE-MS-01.local.",
  "properties": {
    "t": "web",
    "s": "true",
    "d": "false"
  }
}
```

Observed behavior from `designer-plugin` 1.3.1:

- Service type is `_d3plugin._tcp.local.`
- Service name is `<d3plugin.name>._d3plugin._tcp.local.`
- Port is the port passed to `DesignerPlugin.default_init(port)`.
- TXT `t` is `web`.
- TXT `s` mirrors `requiresSession`.
- TXT `d` mirrors `isDisguise`, defaulting to `false`.
- TXT `u` is only present when `url` is set in `d3plugin.json`.
- Server defaults to `<socket.gethostname()>.local.`

## Toolkit Smoke Check

For generated remote plugins:

```bash
npm run cli -- remote dev my-remote
npm run cli -- remote smoke my-remote -- --server --designer --dnssd
```

The `--dnssd` check browses `_d3plugin._tcp.local.` with Python `zeroconf` and
verifies the expected service name, port, `t=web`, and `s=<requiresSession>`.
The `--designer` check asks the generated backend to execute a safe
`return 'connected'` script against Designer's execution API.

## Live Test Notes

The same live session also confirmed:

- Generated Python remote backend health endpoint returned HTTP 200 with
  `{"ok": true}`.
- Generated Python remote frontend returned HTTP 200 through Vite.
- Generated backend could execute a safe Designer connection check against
  `127.0.0.1:80` and received `connected`.

## Caveats

Windows `dns-sd.exe` was present but returned `DNSService call failed -65563` in
the test environment, while Python `zeroconf` successfully discovered the same
service. Prefer the Python `zeroconf` smoke path for toolkit automation.

This smoke verifies DNS-SD advertisement and Designer API connectivity. It does
not prove the Designer UI opened the remote plugin window.
