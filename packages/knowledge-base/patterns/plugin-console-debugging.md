---
type: pattern
status: confirmed
tested: "2026-04-07"
---

# Plugin Console Debugging in Designer

## The problem

Designer's plugin webview is **a CEF instance with DevTools disabled**. You
cannot right-click → Inspect, F12 does nothing, and there is no other way
to open Chromium's developer tools from inside the plugin window. This
makes browser-side debugging of Vue/JS plugins much harder than developing
a normal web app.

## What works

### Designer's main log captures plugin console output

Every `console.log()`, `console.warn()`, `console.error()` call from a
plugin's frontend is captured in **Designer's own log file** (the same file
that gets the `Saving objects/...` and `thread created: ...` lines), prefixed:

```
[WebViewHandler] Console : <your message>, <source URL>:<line>
```

Example from a real session:

```
[WebViewHandler] Console : Failed to load icon for Timecode Switcher at
http://director.local:80/projects/project-name/plugins/plugin-name/icon.svg,
using fallback, http://director.local/js/plugin-launcher.js:17
```

That log line also confirms the local plugin launcher icon convention:
Designer requests `icon.svg` from the plugin web root. In Vite plugins, put the
launcher icon at `public/icon.svg` so the build copies it to `dist/icon.svg`
and the deployed plugin exposes `/plugins/<plugin-name>/icon.svg`. Header logos
used inside the Vue app can still live under `src/assets/` and be imported by
the component.

### How to read it

1. Locate Designer's log file (typically streams to a console window when
   Designer is launched, or to a log file in the project / Designer install
   directory)
2. Filter or `grep` for `[WebViewHandler] Console :`
3. Use a unique tag in your `console.log` calls (e.g. `[LU-EXPERIMENT]`,
   `[MY-PLUGIN]`) so you can grep your messages out of the noise

### When to prefer in-UI status panels instead

Reading Designer's log file is awkward in tight feedback loops. For
anything the user needs to *see while interacting* with the plugin —
diagnostics output, experiment results, error messages — capture the same
data into a Vue reactive ref and render it in the plugin UI directly:

```typescript
const debugLog = ref<DebugEntry[]>([])
function log(message: string, kind: 'info' | 'warn' | 'error' = 'info') {
  console.log(`[MY-PLUGIN] ${message}`)        // Designer log channel
  debugLog.value.push({ ts: Date.now(), kind, message })  // In-UI channel
  if (debugLog.value.length > 50) debugLog.value.shift()
}
```

The `console.log` is the backup, the reactive ref is the primary readout.
This is especially valuable for plugin path-discovery experiments,
LiveUpdate subscription debugging, and any error you want the user to
report back to you exactly.

## Real-world note (2026-04-08)

The OSC investigation session was where the `[WebViewHandler] Console :`
log capture surface was discovered. **CEF DevTools is NOT available in
Designer's plugin webview** — there is no F12, no right-click → Inspect,
no `chrome://` URL, no extension. The Designer main log file is the
ONLY external view into plugin runtime state, and reading it requires
grepping. Plan accordingly.

**Always plan in-UI diagnostic surfaces from the start.** For
experiment-style code (path discovery, format probing, LiveUpdate
subscription debugging) capture every result into a Vue reactive ref so
the user can see it without grepping log files. The session's
`useOsc.ts` LiveUpdate path discovery experiment is a worked example of
this pattern: each candidate path's result was pushed into a debug
table rendered in the plugin UI, so the operator could see all 20+
path attempts without ever opening Designer's log file.

## What does NOT work

- ❌ DevTools (F12, right-click → Inspect, Ctrl+Shift+I)
- ❌ `chrome://` URLs in the plugin window
- ❌ Browser extensions (no Vue DevTools, no React DevTools)
- ❌ Direct WebSocket inspection from within the plugin

## Implications for plugin development workflow

- **Always tag your console output** with a unique prefix per plugin so
  you can grep Designer's log
- **Plan for in-UI debug surfaces** from the start — assume the user has
  no DevTools
- **Avoid relying on browser-only debugging tools** (e.g. the Vue DevTools
  Chrome extension); test the plugin in a normal browser dev server first,
  then deploy to Designer for integration testing
- **For path/format discovery experiments** (LiveUpdate paths, REST endpoint
  formats, etc.), instrument the experiment to surface results in the
  plugin's own UI, not just console

## Related

- `bugs/layer-add-gui-side-effect.md` — another Designer GUI / plugin
  interaction surfacing in the log
- `patterns/liveupdate-subscribe.md` — LiveUpdate subscriptions, where this
  pattern was first needed
