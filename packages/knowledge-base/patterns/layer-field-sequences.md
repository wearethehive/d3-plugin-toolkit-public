---
type: pattern
status: confirmed
tested: "2026-05-04"
---

# Layer FieldSequence Reading — Common Properties

All these properties are read via `layer.findSequence(name)` then
`getSequencedValue(float(layer.tStart)).value`.

**Never access as direct attributes** — several (e.g. `layer.mapping`)
cause native C++ crashes. See `bugs/layer-mapping-direct-access-crash.md`.

## Safe Helper

```python
def _seq_float(layer, seq_name, default=-1.0):
    try:
        fseq = layer.findSequence(seq_name)
        if fseq is None:
            return default
        sv = fseq.getSequencedValue(float(layer.tStart))
        if sv is None or sv.value is None:
            return default
        return float(sv.value)
    except Exception:
        return default
```

## Mapping (FeedProjection name)

```python
mapping_name = ''
try:
    fseq = layer.findSequence('mapping')
    if fseq is not None:
        sv = fseq.getSequencedValue(float(layer.tStart))
        if sv is not None and sv.value is not None:
            mapping_name = str(sv.value.description)  # .name does NOT exist
except Exception:
    pass
```

## Loop / At End Point

Sequence name: `'atEndPoint'`

| Value | Meaning    | Display |
|-------|------------|---------|
| 0     | Loop       | LP      |
| 1     | Ping-pong  | PP      |
| 2     | Pause      | (empty) |

```python
at_end_point = int(_seq_float(layer, 'atEndPoint', 2))
```

## Blend Mode

Sequence name: `'blendMode'`

| Value | Name      | Value | Name     |
|-------|-----------|-------|----------|
| 0     | over      | 10    | hard-lt  |
| 1     | alpha     | 11    | soft-lt  |
| 2     | add       | 12    | burn     |
| 3     | mult      | 13    | darken   |
| 4     | mask      | 14    | lighten  |
| 5     | mlt-fade  | 15    | diff     |
| 6     | mlt-α     | 16    | excl     |
| 7     | premult   | 17    | dodge    |
| 8     | screen    | 18    | hard-mx  |
| 9     | overlay   | 19    | over-α   |
|       |           | 20    | luma     |
|       |           | 21    | inv-luma |

Default is `1` (alpha). Mode `0` (over) is the visual default for video layers.

```python
blend_mode = int(_seq_float(layer, 'blendMode', 1))
```

## Speed

Sequence name: `'speed'`

```python
speed = _seq_float(layer, 'speed', 1.0)
```

## Max Brightness (peak keyframe value)

Sequence name: `'brightness'`

Use keyframe iteration — `getSequencedValue` only gives you the value at one
point; to get the peak intensity you must walk all keyframes:

```python
max_brightness = -1.0
try:
    brseq = layer.findSequence('brightness')
    if brseq is not None:
        fseq = brseq.sequence
        nk = int(fseq.nKeys())
        if nk > 0:
            peak = float(fseq.key(0).v)
            for ki in range(1, nk):
                v = float(fseq.key(ki).v)
                if v > peak:
                    peak = v
            max_brightness = peak
except Exception:
    pass
```

## Colour Sequences

| Sequence name | Field      | Default |
|---------------|------------|---------|
| `'colourX'`   | col_x      | 0.0     |
| `'colourY'`   | col_y      | 0.0     |
| `'brightness'`| bri_shift  | 0.0     |
| `'contrast'`  | contrast   | 1.0     |
| `'saturation'`| sat        | 1.0     |
| `'hue'`       | hue        | 0.0     |

```python
col_x     = _seq_float(layer, 'colourX',    0.0)
col_y     = _seq_float(layer, 'colourY',    0.0)
bri_shift = _seq_float(layer, 'brightness', 0.0)  # brightness shift, not max
contrast  = _seq_float(layer, 'contrast',   1.0)
sat       = _seq_float(layer, 'saturation', 1.0)
hue       = _seq_float(layer, 'hue',        0.0)
```

Note: `'brightness'` serves dual purpose — as a float sequence it gives the
brightness shift value; iterated keyframe-by-keyframe it gives max intensity.

## Transform / Move Sequences

| Sequence name | Field    | Default |
|---------------|----------|---------|
| `'size'`      | size     | 1.0     |
| `'scale.x'`   | scale_x  | 1.0     |
| `'scale.y'`   | scale_y  | 1.0     |
| `'position.x'`| pos_x    | 0.0     |
| `'position.y'`| pos_y    | 0.0     |
| `'rotation'`  | rotation | 0.0     |

Note: scale axes use dot notation (`'scale.x'`, `'scale.y'`).

```python
size     = _seq_float(layer, 'size',       1.0)
scale_x  = _seq_float(layer, 'scale.x',   1.0)
scale_y  = _seq_float(layer, 'scale.y',   1.0)
pos_x    = _seq_float(layer, 'position.x',0.0)
pos_y    = _seq_float(layer, 'position.y',0.0)
rotation = _seq_float(layer, 'rotation',  0.0)
```

## Crop Sequences

| Sequence name  | Field       | Default |
|----------------|-------------|---------|
| `'left'`       | crop_left   | 0.0     |
| `'right'`      | crop_right  | 0.0     |
| `'top'`        | crop_top    | 0.0     |
| `'bottom'`     | crop_bottom | 0.0     |
| `'cropSoftness'`| vignette   | 0.0     |

```python
crop_left   = _seq_float(layer, 'left',        0.0)
crop_right  = _seq_float(layer, 'right',       0.0)
crop_top    = _seq_float(layer, 'top',         0.0)
crop_bottom = _seq_float(layer, 'bottom',      0.0)
vignette    = _seq_float(layer, 'cropSoftness',0.0)
```
