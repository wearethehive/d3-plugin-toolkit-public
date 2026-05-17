---
type: bug
status: confirmed
severity: cosmetic
tested: "2026-04-07"
---

# Adding Layers From Script Triggers GUI Exception

## Symptom

Calling `track.addNewLayer(ModuleClass, beat, dur, name)` from a Python
script context fires Designer's GUI hook `LayerView._onLayerAdded`, which
attempts to open the layer editor widget and crashes with:

```
!!!!! Access to object of type 'Widget' is not allowed.
{
Error at 'MulticastDelegate::call <bound method LayerView._onLayerAdded ...>':
Exception caught in C:\blip\dev\blip\app\app_helper.hpp(46) :
Detail :
Details: class PythonException in 'C:\blip\dev\d3python\pythonobject.cpp' (line 32):
Traceback (most recent call last):
  File "C:\blip\dev\scripts\gui\track\layerview.py", line 949, in _onLayerAdded
  File "C:\blip\dev\scripts\gui\track\layerview.py", line 725, in toggleRequestLayerEditor
  File "C:\blip\dev\scripts\gui\track\layerview.py", line 714, in requestLayerEditor
  File "C:\blip\dev\scripts\gui\track\layerview.py", line 755, in _onUpdate
TypeError: Access to object of type 'Widget' is not allowed.
```

## Impact

**The layer is created successfully and is fully usable.** The exception
is fired by Designer's own GUI listener, not by your code. The script
continues. `track.removeLayer(layer)` works for cleanup.

The only impact is log spam, which makes it hard to read d3Log output
during script development.

## Root cause (suspected)

Designer's `LayerView` class is a GUI component subscribed to layer-add
events. When a layer is added from any source (GUI or script), the
listener fires. From a script context the sandbox forbids access to
`Widget` objects, so opening the layer editor fails. The listener has
no try/except guard.

## Workaround

None known. Options to investigate:

1. **Suppress at the call site** — there is no `silent=True` flag on
   `addNewLayer` (none seen in `d3.pyi`).
2. **Use `track.layers.append()`** — if Resource lists accept appends
   directly, this may bypass the `addNewLayer` event path. Untested.
3. **Pre-create the layer in a known state and reuse** — works for
   plugins that need exactly one persistent layer (e.g. a hidden control
   layer for OSC reception).

## Mitigation in plugin code

When using a Designer-native receiver layer (e.g. an `OscControlModule`
on a hidden control layer), create the layer **once** during plugin
install and reuse it across sessions. Avoid recreating it on every
plugin start.

## Related

- `reference-tools/probe_osccontrolmodule_layer.py` — probe that surfaced this
- `bugs/registermodule-import-d3.md` — separate but related risk: scripts that interact with Designer's GUI lifecycle
