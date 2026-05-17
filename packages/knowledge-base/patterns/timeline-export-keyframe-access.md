---
type: pattern
status: confirmed
tested: "2026-03-25"
designer_version: "r32.3.4"
---

# Timeline Export: Keyframe Access Patterns

## Key Class Hierarchy

Designer uses three key subclasses for keyframe data:

| Key Class | Used For | Property Access | Read Strategy |
|-----------|----------|-----------------|---------------|
| `KeyFloat` | All numeric params (float, int) | SAFE: `localT`, `v`, `interpolation` | Direct read |
| `KeyResource` | Resource refs (video, mapping, palette, output, cdl) | SAFE: `localT`, `r`, `r.path`, `r.description` | Direct read |
| `KeyAsKeyContainer` | Indirection bindings only | CRASHES on any property | `getSequencedValue(t)` fallback |

## Reading KeyFloat (confirmed safe)

```python
fs = layer.findSequence('brightness')
seq = fs.sequence
nk = seq.nKeys()
for ki in range(nk):
    key = seq.key(ki)
    t = float(key.localT)       # beat time
    v = float(key.v)            # value
    interp = int(key.interpolation)  # 0=select, 1=linear, 2=cubic
```

## Reading KeyResource (confirmed safe)

```python
fs = layer.findSequence('video')
seq = fs.sequence
nk = seq.nKeys()
for ki in range(nk):
    key = seq.key(ki)
    t = float(key.localT)
    r = key.r
    if r is not None:
        path = str(r.path)   # e.g. "objects/videoclip/videoin_2.mov.apx"
        name = str(r.description)  # e.g. "videoin_2.mov"
```

## Reading KeyAsKeyContainer (fallback only)

Cannot read any properties. Use `getSequencedValue()` instead:

```python
fs = layer.findSequence('video')
sv = fs.getSequencedValue(layer.tStart)
val = sv.value
if val is not None:
    path = str(val.path)
```

## Identifying Key Type Safely

```python
key0 = seq.key(0)
key_class = str(type(key0).__name__)  # 'KeyFloat', 'KeyResource', or 'KeyAsKeyContainer'
```

`type()` and `str()` are always safe on any key object.

## WARNING: Do NOT use FieldSequence.eval()

`fs.eval(t, 0)` triggers recursive expression evaluation warnings in Designer logs:
```
!!!!! Nested expression hit recursion limit in field brightness
```
Use direct KeyFloat access or `getSequencedValue()` instead.

## VariableVideoModule: Complete Sequence Map (53 sequences)

### KeyResource sequences (5):
mapping, palette, video, output, cdl

### KeyFloat sequences (48):
blendMode, brightness, xCol, yCol, tint.r, tint.g, tint.b, tint.a,
speed, mode, "at end point", "transition time", volume,
"brightness (shift)", "contrast (scale)", "saturation scale", "hue shift",
"RGB controlled", "red min", "red max", "red gamma",
"green min", "green max", "green gamma", "blue min", "blue max", "blue gamma",
threshold, hardness, "key colour.r", "key colour.g", "key colour.b",
size, scale.x, scale.y, pos.x, pos.y, rotation,
left, right, top, bottom, cropSoftness,
acesExposure, acesGamma, ocioExposure, ocioContrast, ocioGamma

### Interpolation constants:
- 0 = select (step)
- 1 = linear
- 2 = cubic (bezier)

## PlayModeModule: 1 sequence
- "play mode" (int, KeyFloat)
