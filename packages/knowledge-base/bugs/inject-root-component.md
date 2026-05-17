---
type: bug
status: confirmed
severity: silent-failure
tested: "2026-03-22"
---

# Vue inject() fails in root component

## Description

`inject()` in Vue 3 searches **ancestor** components, not the current component.
If the root component (App.vue) calls `provide('key', value)` and then a composable
in the same component calls `inject('key')`, it returns `undefined` — silently.

This causes plugin-side polling and other mounted effects to fail with no visible
errors.

## Reproduction

```typescript
// App.vue (root component)
provide('get_transport_state', transportMod.get_transport_state)
const composable = useTransport()  // calls inject('get_transport_state') → undefined!
```

## Symptoms

- Refs stay at initial defaults (timecode shows 00:00:00:00, track shows --)
- No error in console (catch blocks swallow the "not a function" errors)
- Plugin appears connected but never updates

## Fix

Pass values directly to composables instead of using inject:

```typescript
const composable = useTransport(liveUpdate, {
  transport_play: transportMod.transport_play,
  // ...
})
```

Or use inject only in child components where the ancestor chain is valid.
