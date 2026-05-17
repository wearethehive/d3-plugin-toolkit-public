---
type: api
status: works
tested: "2026-03-15"
api_coverage:
  - name: "addNewLayer"
    match: "\\.addNewLayer\\s*\\("
    related_files: []
    required: false
---

# track.addNewLayer()

## Signature

```python
layer = track.addNewLayer(ModuleType, start_beats, length_beats, "LayerName")
```

## Parameters

- `ModuleType` — d3 module class (e.g., `d3.VariableVideoModule`). Requires `import d3`.
- `start_beats` — float, start position on track in beats
- `length_beats` — float, layer duration in beats
- `LayerName` — string, display name for the layer

## Returns

A `Layer` object. Description will be `"{LayerName} in track {trackName}"`.

## Test Script

```python
import d3
import json as _json
_track = guisystem.track
_new = _track.addNewLayer(d3.VariableVideoModule, 0.0, 60.0, "test_video")
return _json.dumps({"ok": True, "type": type(_new).__name__, "desc": str(_new.description)})
```

## Result

```json
{"ok": true, "type": "Layer", "desc": "test_video in track track 1"}
```

## Notes

- Calling with wrong number of args causes `RuntimeError: Incorrect number of arguments to call`
- Calling with 1 arg (just module type) CRASHES — wrong arg count
- Calling with 2 args (module type, string) gives `TypeError: Cannot convert from 'str' to 'double'`
- The d3Log may contain a Widget access warning — this is harmless
- Layer naming: use `layer.description` to read back, strip ` in track {trackDesc}` suffix for short name
