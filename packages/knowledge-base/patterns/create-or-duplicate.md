---
type: pattern
status: workaround
tested: "2026-03-15"
api_coverage:
  - name: "resourceManager.loadOrCreate"
    match: "resourceManager\\.loadOrCreate\\s*\\("
    related_files: ["create-or-duplicate.md"]
    required: false
---

# Create-or-Duplicate Pattern

## Problem

`resourceManager.loadOrCreate()` crashes with ACCESS_VIOLATION when called multiple times for certain resource types (Indirection, ListIndirectionController) in a single script execution.

## Solution

Create one resource with `loadOrCreate`, save it as a template, then use `Resource.duplicate(newPath)` for all subsequent resources of the same type.

```python
import d3

rm = resourceManager
_templates = {}

def create_or_duplicate(path, res_type):
    """Load existing, or duplicate from first-created template."""
    # Try loading existing resource first
    try:
        existing = rm.load(path)
        if existing is not None:
            return existing
    except:
        pass

    # Duplicate from template if we have one
    type_name = res_type.__name__
    if type_name in _templates:
        return _templates[type_name].duplicate(path)

    # First-ever: use loadOrCreate and save as template
    res = rm.loadOrCreate(path, res_type)
    _templates[type_name] = res
    return res
```

## Important Notes

- `duplicate()` **usually** returns generic `Resource`, not the specific subclass.
  **Exceptions confirmed (2026-04-07)**: `TimecodeTransportLtc.duplicate()` and
  `AudioLine.duplicate()` both return the typed subclass directly. When in
  doubt, re-load via `resourceManager.load(path)` after duplicating — it's
  harmless and gets you typed access. See
  [timecode-transport-ltc-lifecycle.md](timecode-transport-ltc-lifecycle.md).
- Properties like `controller`, `expectedType` can still be set on the duplicated resource
- All paths must be lowercase
- The template resource is a real resource in the project (not temporary)

## Confirmed typed-return classes

The original "always returns generic Resource" warning above may have
been over-broad. As of 2026-04-08, `Resource.duplicate()` has been
confirmed to return the typed subclass directly for these classes:

- `TimecodeTransportLtc`
- `AudioLine`
- `OscDevice`

For these you do not need a re-load step after duplicating. For other
types, the safe rule still applies: re-load via
`resourceManager.load(path)` if you need typed access and aren't sure.

## Alternative: constructor + path-assign + collection-add

For `Resource` subclasses where `loadOrCreate` is blocked by the
kb-coverage hook (see
[bugs/loadorcreate-hook-blocks-all-types.md](../bugs/loadorcreate-hook-blocks-all-types.md))
or otherwise impractical, there is an alternative pattern: construct
directly, assign the `path`, then add to a parent collection. Designer's
normal save lifecycle picks up `_blipValue` instances added to a parent
collection and persists them through the parent's save:

```python
import d3
evt = d3.EventTransportOSC()
evt.path = "objects/eventtransportosc/my-transport.apx"
evt.osc_device = some_device
# Adding to a parent collection triggers Designer's normal save lifecycle
tm.local_transports = list(tm.local_transports) + [evt]
resourceManager.saveAll()
```

This was confirmed to work for `EventTransportOSC` in
`reference-tools/probe_eventtransport_osc_v2.py` (final form). The
pattern likely generalises to other Resource subclasses that are
typically owned by a parent collection. Cross-reference:
[bugs/loadorcreate-hook-blocks-all-types.md](../bugs/loadorcreate-hook-blocks-all-types.md),
[python-attribute-assignment-is-permissive.md](python-attribute-assignment-is-permissive.md).
