---
type: pattern
status: confirmed
tested: "2026-10-06"
scope: registered-python-module
api_coverage:
  - name: "Resource.lock"
    match: "\\.lock\\("
    related_files: ["resource-lock-roundtrip.md"]
    required: false
  - name: "Resource.unlock"
    match: "\\.unlock\\("
    related_files: ["resource-lock-roundtrip.md"]
    required: false
  - name: "Resource.locked"
    match: "\\.locked"
    related_files: ["resource-lock-roundtrip.md"]
    required: false
---

# Lock and Unlock a Resource With Readback

## Purpose

Apply the same resource-level lock represented by Designer's right-click
**Lock** command, then verify that Designer accepted the requested state.

The official `Resource` reference documents `lock()`, `unlock()` and the
read-only `locked` property. In a registered plugin module, use them directly
and check the property after every mutation:

```python
previous_locked = bool(resource.locked)
resource.lock()
if not bool(resource.locked):
    raise RuntimeError("Designer did not lock the resource")

# Only when the caller owns or is intentionally reversing this lock:
resource.unlock()
if bool(resource.locked):
    raise RuntimeError("Designer did not unlock the resource")
```

`Resource.setLock(bool)` is also documented, but this probe specifically
confirmed the semantically explicit `lock()` and `unlock()` pair.

## Safety and ownership

- Identify the target by UID when possible. Timeline layers may have an empty
  resource path.
- Read the initial state before mutating it.
- Do not claim ownership of a lock that was already present.
- Do not unlock a pre-existing manual lock when removing plugin-side tracking.
- A reversible probe must restore the initial state in `finally`.
- Read back `resource.locked`; a successful execute response alone is not proof
  that Designer applied the state.

## Confirmed result

`reference-tools/probe_resource_lock_roundtrip.py` ran through a registered
module on Designer r34.0.3.258249 against the one currently edited Video layer.
The layer started unlocked, `lock()` produced `locked == True`, `unlock()`
produced `locked == False`, and the final cleanup confirmed the original
unlocked state was restored.

The official layer guide states that a locked layer cannot be edited until it
is unlocked, matching the behavior requested by Designer's timeline Lock menu.
