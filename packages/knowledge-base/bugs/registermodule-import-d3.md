---
type: bug
status: confirmed
severity: error
tested: "2026-03-17"
crashers:
  - pattern: "\\bregisterModule\\b[\\s\\S]{0,200}\\bimport d3\\b"
    message: "Module-level 'import d3' fails in registerModule context. Move import d3 inside each function body."
    severity: error
---

# import d3 at module level breaks in registered modules

## Problem

When using `@disguise-one/designer-pythonapi`, putting `import d3` at the top of a `.py` module causes `d3.SomeType` references inside functions to fail with HTTP 500.

The module-level `import d3` runs during `/api/session/python/registermodule` but the `d3` reference does not carry into the `/api/session/python/execute` context where functions actually run.

## Symptom

```
AxiosError: Request failed with status code 500
```

When calling any function that references `d3.VariableVideoModule`, `d3.Indirection`, etc.

## Workaround

Move `import d3` inside each function body that needs it:

```python
__all__ = ["create_layers"]

import json  # stdlib imports at module level are fine

def create_layers():
    import d3  # MUST be inside the function
    track = guisystem.track
    track.addNewLayer(d3.VariableVideoModule, 0.0, 15.0, "test")
    return json.dumps({"ok": True})
```

## What still works at module level

- `import json` (and other stdlib: `csv`, `re`, `collections`, `datetime`, `traceback`)
- **`import os` is SHADOWED** — Designer has a global `OS` object that overrides stdlib `os`. Use `import os as _os` inside the function body instead
- Sandbox globals inside functions: `guisystem`, `resourceManager`, `markDirty()`
- **`trackTime()` is NOT available** in registered module functions — use `guisystem.player.tCurrent` instead
- The global `d3` application object (e.g. `d3.projectPaths`) — this is NOT the same as `import d3`
