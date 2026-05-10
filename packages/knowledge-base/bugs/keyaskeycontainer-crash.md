---
type: bug
status: confirmed
severity: crash
tested: "2026-03-16"
designer_version: "r32.3.4"
crashers:
  - pattern: "\\.key\\s*\\(\\s*\\d+\\s*\\)\\.\\w+"
    message: "Accessing properties on KeyAsKeyContainer crashes Designer. Use getSequencedValue() as a fallback. Read bugs/keyaskeycontainer-crash.md."
    severity: crash
---

# KeyAsKeyContainer Property Access Crash

## Description

`ResourceSequence.key(i)` returns a `KeyAsKeyContainer` object. Accessing ANY property on this
object causes an HTTP 500 crash (native ACCESS_VIOLATION, not catchable with try/except).

## Affected Properties (all crash)

- `.r`
- `.resource`
- `.controller`
- `.description`
- `.t`
- `.keyContainer`
- `.uid`, `.path`
- `getattr(key, attr, default)` — also crashes (calls the descriptor internally)

## What Works

- `type(key0)` — returns `<class 'd3.KeyAsKeyContainer'>`
- `str(key0)` — returns `<_blipValue(KeyAsKeyContainer) instance at 0x...>`

## Test Script

```python
track = guisystem.track
layer = track.layers[20]  # any layer
fseq = layer.findSequence("video")
seq = fseq.sequence
key0 = seq.key(0)

# These work:
# str(key0)
# type(key0)

# These ALL crash with HTTP 500:
# key0.r
# key0.resource
# key0.description
# key0.t
# key0.controller
# getattr(key0, "r", None)
```

## Workaround

Cannot read keyframe resource bindings via the Python API through the key object.
If you know the Indirection/Controller paths, load them directly via `resourceManager.load(path)`.
