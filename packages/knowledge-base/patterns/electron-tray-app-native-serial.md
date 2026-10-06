---
type: pattern
status: confirmed
tested: "2026-05-13"
scope: electron-bridge
---

# Electron Tray App with a Native Serial-Port Dependency

## Context

A tested hardware bridge packages the `loupedeck` npm library (ESM-only, v7+)
inside an Electron 31 tray app. `loupedeck` uses
`@serialport/bindings-cpp` (a native
N-API module) under the hood.

## Rule 1 — Use `autoConnect: false` + explicit `connect()` in Electron

In plain Node.js, `discover()` with `autoConnect: true` (the default) works:
`_connectBlind()` fires in the constructor, the serial port opens, and the
`'connect'` event fires reliably.

**In Electron, `_connectBlind()` silently fails.** Errors are swallowed by
`.catch(() => {})` and the `'connect'` event never fires. The device appears
to be found (`discover()` resolves) but the connection never completes.

**Fix:** Pass `{ autoConnect: false, reconnectInterval: 0 }` to `discover()`
and call `device.connect()` explicitly, with a race to catch errors and
timeouts. Manage reconnects yourself.

```js
const device = await discoverFn({ autoConnect: false, reconnectInterval: 0 })

device.on('connect', () => { /* ... */ })
device.on('disconnect', (err) => {
  // schedule reconnect ourselves since reconnectInterval: 0
  reconnectTimer = setTimeout(connectDevice, err?.message?.includes('access denied') ? 1500 : 3000)
})

// Explicit connect with race — serial.js connect() hangs forever on open error
// because `await new Promise(res => port.once('open', res))` has no rejection path.
try {
  await Promise.race([
    device.connect(),
    new Promise((_, reject) => {
      const onDisc = (err) => reject(err ?? new Error('pre-connect disconnect'))
      device.once('disconnect', onDisc)
      device.once('connect', () => device.removeListener('disconnect', onDisc))
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 8000)),
  ])
} catch (err) {
  // handle access denied, other errors, timeout — then schedule retry
}
```

## Rule 2 — Never call `device.connect()` after `discover()` with `autoConnect: true`

If `autoConnect: true` is used (the default), `_connectBlind()` fires in the
constructor before `discover()` even resolves. Calling `device.connect()` after
this creates a **second concurrent SerialPort** on the same COM port. Both
compete for the port → one gets `ACCESS DENIED` → `onDisconnect` fires →
`reconnectInterval` schedules another `_connectBlind()` → cascading storm of
concurrent connection attempts.

## Rule 3 — `asarUnpack` must include the native prebuilt

`@serialport/bindings-cpp` ships prebuilt N-API binaries. These `.node` files
cannot be loaded from inside an ASAR archive. electron-builder config:

```json
"build": {
  "asarUnpack": ["node_modules/@serialport/bindings-cpp/prebuilds/**"]
}
```

electron-builder also rebuilds native deps automatically during `npm run dist`
(`rebuilding native dependencies` in build output confirms this).

## Rule 4 — loupedeck is ESM-only; load via dynamic `import()` in CJS Electron main

```js
// In CommonJS main.js:
let discoverFn = null
// ...
if (!discoverFn) {
  const mod = await import('loupedeck')
  discoverFn = mod.discover
}
```

## Rule 5 — Use a generation counter to prevent stale callbacks

Each `connectDevice()` call increments a counter. All event handlers close over
`live = () => gen === connectGen` and return early if superseded.

```js
const gen = ++connectGen
const live = () => gen === connectGen && state.running
```

## Rule 6 — Quit the Running App Before Running `npm run dist`

electron-builder rebuilds native modules (e.g. `canvas`, `@serialport/bindings-cpp`)
during packaging. If the app is currently running, these `.node` files are held
open by the process and the build fails with:

```
EBUSY: resource busy or locked, open '...canvas\build\Release\canvas.node'
EPERM: operation not permitted, unlink '...\libbrotlidec.dll'
```

Quit the tray app before every build. There is no workaround short of rebooting
or killing the Electron process from Task Manager.

Also: electron-builder's output directory defaults to `dist/`, which is the same
path Vite uses for the Vue build output. Set `directories.output` in the build
config to a different folder (e.g. `installer/`) to avoid clobbering the Vue
build:

```json
"build": {
  "directories": { "output": "installer" }
}
```

Run the Vue build first (`npm run build` in the plugin package), then
`npm run dist` in the electron app package.

---

## `serial.js connect()` hang — root cause

`loupedeck/connections/serial.js` `connect()` does:
```js
await new Promise(res => this.connection.once('open', res))
```
There is **no rejection path**. If the SerialPort emits `'error'`, `onError`
fires → `onDisconnect` → device emits `'disconnect'`, but the Promise above
never rejects and hangs forever. This is why the `Promise.race` with a
`device.once('disconnect', ...)` leg is essential.

