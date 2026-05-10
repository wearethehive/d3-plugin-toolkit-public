---
type: pattern
status: confirmed
---

# TransportManager Access from Python Sandbox

## Rule

`guisystem.transportManager` is **declared in `d3.pyi` but NOT exposed in the
Python sandbox**. Reading it raises `AttributeError`. Same for
`guisystem.transport` and `guisystem.session`.

The correct access path is:

```python
import d3
tm_list = resourceManager.allResources(d3.TransportManager)
tm = tm_list[0]   # most projects have one, named "default"
```

This returns the actual `TransportManager` resource(s). Match by
`str(tm.path)` if more than one exists (path looks like
`objects/transportmanager/default.apx`).

## Why this matters

A `safe()` wrapper around `guisystem.transportManager` will silently return
`None`, which looks identical to "no timecode assigned" and will send you
hunting for state that isn't missing. Both probes
`probe_timecode_devices.py` and `probe_active_timecode.py` hit this.

## Confirmed properties on TransportManager

- `tm.timecode` → `TimecodeTransport` (settable; round-trip confirmed by
  `probe_timecode_assign.py`)
- `tm.engaged` → bool (independent of `.timecode` — a manager can have a
  source assigned while disengaged; the assignment still reads back)
- `tm.timecode_can_change_track` → int
- `tm.beatToTimecode(beat)` / `tm.smpteClockType()`

## Related

- [transport-commands.md](transport-commands.md) — playback control patterns
- `reference-tools/probe_active_timecode.py` — the probe that uncovered this
- `reference-tools/probe_timecode_devices.py` — full LTC/AudioLine inventory
