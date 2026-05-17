---
type: bug
status: confirmed
severity: crash
tested: "2026-03-15"
crashers:
  - pattern: "\\.addLayer\\s*\\("
    message: "track.addLayer() crashes Designer at C++ level (not catchable). Use track.addNewLayer(Type, start, length, name) with exactly 4 args."
    severity: crash
  - pattern: "\\.layers\\.append\\s*\\("
    message: "track.layers.append() crashes Designer. Use track.addNewLayer(Type, start, length, name)."
    severity: crash
---

# track.addLayer() and track.layers.append() crash

## Description

Both `track.addLayer()` and `track.layers.append()` cause HTTP 500 at the C++ level. These are NOT catchable by Python try/except.

## Reproduction

```python
# Either of these will crash:
track.addLayer(some_layer)
track.layers.append(some_layer)
```

## Workaround

Use `track.addNewLayer()` with exactly 4 arguments:

```python
import d3
layer = track.addNewLayer(d3.VariableVideoModule, 0.0, 15.0, "LayerName")
```
