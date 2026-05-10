---
type: pattern
status: observed
tested: "2026-04-19"
scope: plugin-frontend
api_coverage:
  - name: "Designer plugin window meta tags"
    match: "disguise-plugin-window-size|d3-plugin-width|window\\.resizeTo|confirm\\s*\\("
    related_files: ["plugin-window-sizing.md", "plugin-console-debugging.md"]
    required: false
---

# Plugin Window Sizing in Designer CEF

## Summary

Designer owns the OS window frame for local plugin panels. The plugin page can
control the initial window size through static `<meta>` tags only. Runtime
resize attempts affect page layout at most; they do not resize the host window.

## Initial Size Meta Tags

Use both the newer `disguise-plugin-*` tags and the legacy `d3-plugin-*` tags
for widest Designer compatibility:

```html
<meta name="disguise-plugin-window-size" content="50,50" />
<meta name="disguise-plugin-window-min-size" content="5,10" />
<meta name="disguise-plugin-window-resizable" content="true" />

<meta name="d3-plugin-width" content="50" />
<meta name="d3-plugin-height" content="50" />
<meta name="d3-plugin-min-width" content="5" />
<meta name="d3-plugin-min-height" content="10" />
<meta name="d3-plugin-resizable" content="true" />
```

Designer reads these when the plugin is first opened, then saves and restores
geometry itself on later opens.

## Runtime Resize Does Not Work

Do not spend time on these approaches in Designer CEF:

- `window.resizeTo(w, h)`
- changing `document.body` or `document.documentElement` dimensions
- CSS shrinking `html, body`
- `window.postMessage` resize requests
- mutating meta tags after load

They do not reach the Designer-managed outer window frame.

## Recommended UX

Start small and useful. Let the user drag once; Designer will remember the
geometry.

For compact utility plugins, open in a collapsed state and persist the user's
expanded/collapsed UI preference separately from the host window geometry.

```ts
const compact = ref(true)
```

## `confirm()` Is Not Reliable

Designer CEF can make `window.confirm()` return `false` for plugin UI flows. Do
not use it for destructive actions because it can silently cancel the operation.

Use inline two-step confirmation instead:

```ts
const confirming = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function requestDelete() {
  if (confirming.value) {
    if (confirmTimer) clearTimeout(confirmTimer)
    confirming.value = false
    deleteItem()
    return
  }

  confirming.value = true
  confirmTimer = setTimeout(() => {
    confirming.value = false
  }, 3000)
}
```
