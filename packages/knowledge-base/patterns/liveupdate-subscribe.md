---
type: pattern
status: confirmed
tested: "2026-03-22"
api_coverage:
  - name: "liveUpdate.subscribe"
    match: "liveUpdate\\.subscribe"
    related_files: ["liveupdate-subscribe.md"]
    required: false
---

# vue-liveupdate Subscriptions

## Overview

Use `@disguise-one/vue-liveupdate` WebSocket subscriptions for real-time Designer state
instead of HTTP polling via `designer-pythonapi`. Subscriptions push updates at 50ms
(default) — frame-accurate with zero polling overhead.

**Rule of thumb**: Read state via `liveUpdate.subscribe()`. Write/command via Python exec.

## Setup

```typescript
import { useLiveUpdate, LiveUpdateOverlay } from '@disguise-one/vue-liveupdate'

// One instance per plugin — share via provide/inject
const liveUpdate = useLiveUpdate(endpoint.value)
```

## Object Path Format

Object paths use `type:name` format derived from the resource path:

| Resource Path | Object Path |
|---------------|-------------|
| `objects/transportmanager/default.apx` | `transportManager:default` |
| `objects/track/track1.apx` | `track:track1` |
| `objects/screen/screen2.apx` | `screen2:surface_1` |

> ⚠️ **Object names with spaces are unparseable.** A path like
> `track:track 1` (with a space) triggers
> `Live Update Error: Unable to subscribe to object: UnexpectedToken`.
> This was conclusively proven in `reference-tools/probe_layer_module_r32.py`
> after multiple rounds of investigation. The parser tokenises on
> whitespace and we found no escaping form that worked. **Workaround:
> rename resources to use no spaces (or underscores) — e.g. `track 1` →
> `track1`.**

## subscribe vs autoSubscribe

```typescript
// subscribe — you name the keys
const { tRender, isPlaying } = liveUpdate.subscribe('transportManager:default', {
  tRender: 'object.player.tRender',
  isPlaying: 'object.player.playing',
})

// autoSubscribe — strips 'object.' prefix automatically
// 'object.offset' → key 'offset'
const { offset, rotation } = liveUpdate.autoSubscribe('screen2:surface_1', [
  'object.offset',
  'object.rotation',
])
```

## Return Values

Both methods return `Record<string, SubscriptionValue>` where `SubscriptionValue` extends
`ComputedRef<any>`. Access with `.value` in script, auto-unwraps in templates.

Each subscription value has:
- `.freeze()` — pause updates (for hidden/offscreen components)
- `.thaw()` — resume updates
- `.isFrozen()` — check state

## Update Frequency

```typescript
// Global default
const liveUpdate = useLiveUpdate(endpoint, { updateFrequencyMs: 100 })

// Per-subscription override
const subs = liveUpdate.subscribe('transportManager:default', {
  tRender: 'object.player.tRender',
}, { updateFrequencyMs: 50 })  // 50ms = highest frequency (default)
```

## Tested Transport Properties

All confirmed working with `'transportManager:default'`:

| Property Path | Type | Description |
|---------------|------|-------------|
| `object.player.tRender` | float | Playhead position (frame-quantized) |
| `object.player.playing` | bool | True during playback |
| `object.player.stopped` | bool | True when stopped |
| `object.engaged` | bool | Transport engaged state |

## Confirmed subscription paths (all probed 2026-04-08)

| Object | Property Path | Type | Notes |
|---|---|---|---|
| `transportManager:default` | `object.player.tRender` | float | transport render time |
| `transportManager:default` | `object.player.playing` | bool | |
| `transportManager:default` | `object.player.stopped` | bool | |
| `transportManager:default` | `object.engaged` | bool | |
| `track:<no-space-name>` | `object.tc_adjust` | float | direct Track attribute |
| `track:<no-space-name>` | `object.trigger_note` | string | direct Track attribute |
| `track:<no-space-name>` | `object.layers[N].module.variable_1` | float | indexed collection access into hosted module |

### Indexed collection access IS supported

`object.layers[N].module.variable_1` works on a track object path.
Numeric `[N]` works in property paths. String-key access `["name"]` and
method calls like `findLayerByName("name")` were untested because the
numeric form succeeded first — try numeric indexing before reaching for
fancier syntax.

## Errors observed and what they mean

| Error | Meaning |
|---|---|
| `UnexpectedToken` on the object-path side | Parse error in the object name. Most often caused by spaces in resource names — rename the resource. |
| Subscription returns `undefined` initial value | The property has never been pushed; default-state values may not push an initial. The value will appear when it next changes. |

## See also: Disguise expressions guide

The `osc:/address` syntax used **inside expressions** on layer
FieldSequences is a **different surface** from LiveUpdate property paths.
Expressions are a render-pipeline binding evaluated by the Expression
engine; LiveUpdate is a WebSocket subscription out of Designer's state
push. Don't confuse them — see
`https://developer.disguise.one/python-api/guides/expressions`.

## Architecture Pattern

```
┌─────────────────────────────────────────┐
│  Read state    → liveUpdate.subscribe() │  WebSocket, 50ms push
│  Send commands → pythonapi.execute()    │  HTTP POST, on-demand
└─────────────────────────────────────────┘
```

## Common Mistakes

### inject() in root component
`inject()` looks at ANCESTOR components, not the same component. If your root App.vue
calls `provide('foo', bar)` then `inject('foo')` in the SAME component returns undefined.
Pass values directly or use a child component.

### Polling for values that can be subscribed
If a value exists on a Designer object, prefer `subscribe()` over polling Python exec.
Polling requires HTTP round-trips and will never be frame-accurate.

## Visibility Optimization

Use `useSubscriptionVisibility` to auto-freeze subscriptions when components scroll offscreen:

```typescript
import { useSubscriptionVisibility } from '@disguise-one/vue-liveupdate'

const myComp = useTemplateRef<HTMLElement>('myComp')
const subs = liveUpdate.autoSubscribe('transportManager:default', ['object.player.tRender'])
useSubscriptionVisibility(myComp, subs)
```
