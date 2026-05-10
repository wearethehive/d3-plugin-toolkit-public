---
type: bug
status: confirmed
severity: crash
tested: "2026-04-11"
crashers:
  - pattern: "\\.resize\\s*\\([^\\)]*Int2"
    condition: "\\.clear\\s*\\(|\\.forceUpload\\s*\\("
    message: "DxTexture.resize() enters CPU write mode; clear()/forceUpload() afterward can native-crash. Use resizeTarget(...)+clear(...)."
    severity: crash
---

# DxTexture.resize() Leaves Texture in Writing-Pixels Mode

## Symptom

Calling `tex.clear(...)` or `tex.forceUpload()` after
`tex.resize(d3.Int2(...))` raises `RuntimeError: isWritingPixels()` from the C++
layer. In local output-capture probes this bypassed normal Python handling and
returned HTTP 500 to the caller.

## Bad Pattern

```python
import d3

tex = resourceManager.loadOrCreate(
    "objects/texture/probe_blackout_mask.apx",
    d3.DxTexture,
)
tex.resize(d3.Int2(1, 1))
tex.clear(d3.Colour(0, 0, 0, 1))  # native crash
```

## Workaround

Use `resizeTarget()` for textures you intend to clear as render targets.

```python
import d3

tex = resourceManager.loadOrCreate(
    "objects/texture/probe_blackout_mask.apx",
    d3.DxTexture,
)
tex.resizeTarget(d3.Int2(1, 1), 0, 0, 0, 1, 1)
tex.clear(d3.Colour(0, 0, 0, 1))
tex.save()
```

ETF_NONE (`0`) was valid for the 1x1 blackout-mask use case.

## Affected Calls

- `DxTexture.resize()` before `clear()`
- `DxTexture.resize()` before `forceUpload()`

The confirmed safe replacement is `DxTexture.resizeTarget()` followed by
`clear()`.
