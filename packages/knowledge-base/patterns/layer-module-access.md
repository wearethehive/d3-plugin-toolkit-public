---
type: pattern
status: confirmed
tested: "2026-04-07"
designer_version: "r32.4"
---

# layer.module Access Pattern

## Rule

`layer.module` IS the canonical access path to the typed module on a layer.
Use it without hesitation.

```python
import d3
new_layer = track.addNewLayer(d3.OscControlModule, beat, dur, name)
osc_module = new_layer.module    # -> OscControlModule typed instance
osc_module.osc_device = some_device
osc_module.command = d3.OscCommand()
osc_module.command.address = "/timecode/select"
value = osc_module.variable_1
```

This works on the layer object returned by `addNewLayer` AND on layers
re-fetched via `track.layers` iteration. There is no caching subtlety.

## Counter to retired Known Crasher

`docs/reference.md` previously listed `layer.module (r32.0+) removed property`.
That entry was retired on 2026-04-07 after a counter-probe ran on r32.4 and
demonstrated `.module` works in every tested form. The retirement is recorded
in the Known Crashers table itself for traceability.

## Critical structural detail

The object returned from `addNewLayer(SpecificModuleClass, ...)` is base
`Layer`, **NOT** a subclass like `OscControlModuleLayer`. The module-specific
fields (e.g. `osc_device`, `command`, `variable_1`) live on the module
returned by `.module`, NOT directly on the layer.

```python
hasattr(layer, "module")        # True
hasattr(layer, "osc_device")    # False — must go through .module
type(layer).__name__            # "Layer", not "OscControlModule"
type(layer.module).__name__     # "OscControlModule"
```

## Re-fetching layers across script boundaries

Each `d3 exec` call is a fresh script — Python references from a previous
script do not survive. To re-find a previously-created layer, iterate
`track.layers` and match on `layer.name`:

```python
def find_layer_by_name(track, name):
    layers = track.layers
    for i in range(len(layers)):
        L = layers[i]
        try:
            if L.name == name:
                return L
        except:
            pass
    return None
```

`.module` resolves correctly on layers found this way — confirmed by
`probe_layer_module_r32.py` test T2.

## Related

- [transport-manager-access.md](transport-manager-access.md) — another stub-vs-reality access path issue
- [osc-device-lifecycle.md](osc-device-lifecycle.md) — uses `.module` to wire OscControlModule
- `bugs/layer-add-gui-side-effect.md` — benign GUI exception on layer creation; does NOT affect `.module` access
