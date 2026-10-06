---
type: bug
status: confirmed
tested: "2026-10-06"
designer_version: "r34.0.3"
severity: error
api_coverage:
  - name: "local plugin launcher session hostname CORS"
    match: "requiresSession|plugin-launcher|Access-Control-Allow-Origin"
    related_files:
      - "local-plugin-launcher-session-hostname-cors.md"
      - "local-project-plugin-manifest-and-preflight.md"
    required: false
---

# Local Plugin Launcher Native Open Can Fail Across Hostname Aliases

## Symptom

The local plugin appears in Plugin Launcher, but clicking its icon does not
open the plugin page. Designer logs show Plugin Launcher failing before the
entry page loads:

```text
Access to fetch at 'http://<machine>/api/session/python/execute'
from origin 'http://<machine>.local' has been blocked by CORS policy
```

## Root cause

On Designer r34.0.3, the installed Plugin Launcher always opens a plugin in
Designer mode by posting this script to the `target` query hostname:

```python
from plugin import openPlugin
openPlugin(plugin_metadata)
```

The launcher page was served from the `.local` director hostname, while
`target` was the bare machine hostname. The browser therefore rejected the
cross-origin POST. This happens independently of the plugin's
`requiresSession` value; that field only controls whether the icon is blocked
when there is no active session.

## Fix

The toolkit can bypass the browser-origin hop and dispatch the same native
`plugin.openPlugin(...)` call through `d3 exec` against `127.0.0.1`. This is a
working local workaround and a useful proof that the plugin itself is healthy.

A permanent fix for the icon requires Disguise's launcher to send the native
open call to the `director` endpoint (or otherwise use a same-origin endpoint)
instead of the bare `target` alias. That code is part of the installed Designer
web launcher, not the local plugin bundle.

The plugin should still align its own same-machine API endpoint to
`window.location.hostname` after it opens. Do not rewrite a genuinely remote
Director hostname.

## Verification

- Plugin Launcher advertised the test plugin with `requiresSession: false`, but
  the icon click still made the failing POST to the bare `target` hostname.
- `npm run cli -- exec --file <open-script.py>` dispatched the launch through
  localhost in the same running Designer session.
- Designer logged the native plugin-open event, loaded the entry page and assets
  with HTTP 200, registered the plugin's Python module, and completed its Python
  calls with HTTP 200.
- The plugin loaded through Designer's project web route when the `director`
  query used the bare machine hostname and the launcher origin used its
  corresponding `.local` alias.
- The page reported `Designer connected` and completed its live project
  inventory request.

The native icon remains affected until the installed launcher or machine host
alias behavior is corrected.

## Related

- `patterns/local-project-plugin-manifest-and-preflight.md`
- `bugs/local-plugin-discovery-stale-after-invalid-manifest.md`
