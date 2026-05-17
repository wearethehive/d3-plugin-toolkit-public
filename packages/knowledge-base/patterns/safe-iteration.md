---
type: pattern
status: required
tested: "2026-03-15"
---

# Safe Iteration

## Problem

d3 collections (e.g., `track.layers`, `resourceManager.allResources()`) do NOT support Python `for x in collection` iteration.

## Solution

Always use index-based access:

```python
# WRONG — will crash
for layer in track.layers:
    print(layer.name)

# RIGHT — use index access
for i in range(len(track.layers)):
    layer = track.layers[i]
    print(layer.name)
```

## Also Note

- Use `getattr(obj, 'attr', None)` for safe attribute access
- Use `callable(x)` before calling unknown attributes
- Wrap `len()` calls in try/except for safety
