---
type: bug
status: confirmed
severity: error
tested: "2026-03-18"
designer_version: "r32.3.4"
---

# resourceManager.load() returns untyped Resource without type arg

## Problem

`resourceManager.load(path)` without a second argument returns a base `Resource` object,
regardless of the actual type stored at that path. Accessing type-specific properties
(e.g. `.controller` on an Indirection, `.resources` on a ListIndirectionController) causes HTTP 500.

```python
ctrl = resourceManager.load("objects/listindirectioncontroller/my_ctrl.apx")
type(ctrl).__name__  # "Resource" — NOT "ListIndirectionController"
ctrl.resources       # HTTP 500 crash
```

## Fix

`resourceManager.load(path, Type)` accepts an optional second type argument that returns
a properly typed resource:

```python
ctrl = resourceManager.load("objects/listindirectioncontroller/my_ctrl.apx", ListIndirectionController)
type(ctrl).__name__  # "ListIndirectionController"
ctrl.resources       # works

clip = resourceManager.load("objects/videoclip/sample/ada.jpg.apx", VideoClip)
type(clip).__name__  # "VideoClip"
```

Use `load(path, Type)` for existing resources, `loadOrCreate(path, Type)` when the resource may not exist yet.
Both return properly typed resources when the type argument is provided.
