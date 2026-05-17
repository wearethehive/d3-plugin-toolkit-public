---
type: bug
status: confirmed
severity: crash
tested: "2026-03-15"
crashers:
  - pattern: "\\bstate\\.track\\b"
    message: "state.track causes HTTP 500. Use guisystem.track instead."
    severity: crash
---

# state.track causes HTTP 500

## Description

Accessing `state.track` in the Python sandbox causes an HTTP 500 error. The correct way to access the track is via `guisystem.track`.

## Reproduction

```python
# This crashes:
track = state.track
```

## Workaround

```python
track = guisystem.track
```
