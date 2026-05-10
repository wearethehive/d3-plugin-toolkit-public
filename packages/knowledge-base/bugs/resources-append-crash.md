---
type: bug
status: confirmed
severity: crash
tested: "2026-03-17"
designer_version: "r32.3.4"
crashers:
  - pattern: "\\.resources\\.append\\s*\\("
    message: "ctrl.resources.append() crashes Designer. Use full list assignment: ctrl.resources = [list]."
    severity: crash
  - pattern: "\\.resources\\.erase\\s*\\("
    message: "ctrl.resources.erase() crashes Designer. Use full list assignment: ctrl.resources = [list]."
    severity: crash
---

# ctrl.resources.append() causes HTTP 500

## Problem

Calling `.append()` on a `ListIndirectionController.resources` array causes an HTTP 500 crash.

```python
ctrl.resources.append(clip)  # HTTP 500 crash
```

## Workaround

Use full list assignment instead:

```python
clips_list = []
for ci in range(len(all_clips)):
    clip = all_clips[ci]
    if str(getattr(clip, "description", "")) == target_name:
        clips_list.append(clip)
        break
ctrl.resources = clips_list  # WORKS
```

## Also crashes

- `ctrl.resources.erase(0)` — also crashes

## What works

- `ctrl.resources = python_list` — full list assignment
- `len(ctrl.resources)` — reading length
- `ctrl.resources[i]` — indexing (read)
