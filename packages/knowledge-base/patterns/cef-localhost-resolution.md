---
type: pattern
status: confirmed
tested: "2026-05-13"
scope: plugin-frontend
---

# CEF `localhost` vs `window.location.host` for Python API Targeting

## Rule

In the tested multi-machine Designer CEF flow, `window.location.host` returned
the director's hostname even when the plugin window was open on a performer.
The page itself was served from the director's web server.

To call the Python API on **the machine running the plugin UI** (i.e. the
local Designer instance, not the director), use `localhost` as the host — not
`window.location.host`. CEF always resolves `localhost` to the machine it is
physically running on, regardless of where the page was loaded from.

## Why this matters

Plugins using `@d3-toolkit/shared` get their Python API endpoint from
`getDirectorEndpoint()`, which reads `?director=<host>` from the URL. This
correctly targets the director. If you want to target the local machine
(e.g. to read `guisystem.selectedLayers` from a non-director operator station),
you **must** use `localhost`, not `window.location.host`.

## What works

```typescript
// ✅ Always hits the local Designer instance — the machine CEF runs on
const localEndpoint = `localhost:${new URLSearchParams(window.location.search).get('port') ?? '80'}`

// ✅ Hits the director (standard behaviour)
const directorEndpoint = getDirectorEndpoint()  // reads ?director= from URL

// ❌ Returns the page-serving director, not necessarily the local machine
const wrong = window.location.host  // e.g. "director-host.local"
```

## Confirmed scenario

Plugin URL: `http://director-host.local/projects/.../plugins/my-plugin/index.html?director=director-host.local&port=80`  
Running on: performer machine  
`window.location.host` → `"director-host.local"` (director, not performer)  
`localhost` fetch → hits performer's own Designer Python API ✓

## When to use "run on local machine"

`guisystem.selectedLayers` is **per-machine GUI state**. If an operator runs
Designer on a non-director machine and selects layers there, only that
machine's Python API knows about the selection. Transport state
(`guisystem.player.activeLayers`, `guisystem.player.tCurrent`) is synced from
the director to all machines, so it is identical everywhere.

