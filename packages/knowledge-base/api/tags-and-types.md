---
type: api
status: works
tested: "2026-03-22"
---

# d3.Tag and Type Access

## d3.Tag

Both `d3.Tag` and bare `Tag` resolve to `<class 'd3.Tag'>` in registered modules.
Convention: use `d3.Tag` with explicit import.

```python
import d3
tag = d3.Tag("my_tag")
```

## Module Types for addNewLayer

All tested with `track.addNewLayer(ModuleType, start, length, name)`:

| Type | Status | Notes |
|------|--------|-------|
| `d3.VariableVideoModule` | WORKS | Standard video layer |
| `d3.GradientModule` | WORKS | Warning about `dither` default range (benign) |
| `d3.AudioModule` | WORKS | Has `.track`, `.output`, `.volume` properties |

## Widget Access Warning

When creating layers programmatically, Designer logs:

```
TypeError: Access to object of type 'Widget' is not allowed.
```

This comes from Designer's internal `LayerView._onLayerAdded` — NOT from plugin code.
The layer is created successfully. This warning is **harmless and expected**.
