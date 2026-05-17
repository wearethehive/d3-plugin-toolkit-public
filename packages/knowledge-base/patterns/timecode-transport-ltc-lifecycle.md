---
type: pattern
status: confirmed
tested: "2026-04-07"
---

# TimecodeTransportLtc Create / Configure / Remove Lifecycle

## Pattern

Create new LTC sources by duplicating an existing `TimecodeTransportLtc`,
then setting properties. Cleanup via `resourceManager.remove(path)`.

```python
import d3

rm = resourceManager
existing = rm.allResources(d3.TimecodeTransportLtc)
if not existing:
    raise RuntimeError("need at least one template LTC to duplicate from")

template = existing[0]
new_path = "objects/timecodetransportltc/ltc-3.apx"

# Duplicate — returns the typed subclass directly (NOT generic Resource —
# this contradicts create-or-duplicate.md for this type, see note below)
new_ltc = template.duplicate(new_path)

# Configure
new_ltc.SMPTE_clock_type = 2     # 0=23.976, 1=24, 2=25, 3=29.97, 4=29.97DF, 5=30
new_ltc.line_in = some_audio_line  # AudioLine resource
new_ltc.nFramesToSync = 1

# Removal
rm.remove(new_path)
```

## Field reference

| Field | Type | Notes |
|---|---|---|
| `SMPTE_clock_type` | int | `{0:'23.976', 1:'24', 2:'25', 3:'29.97', 4:'29.97 DF', 5:'30'}` |
| `line_in` | `AudioLine` | Settable; use existing AudioLine resource |
| `nFramesToSync` | int | Frames before sync engages |
| `current` | `Timecode` | Live readout (read-only) |
| `updateStatusString` | str | Human-readable lock state |

## Important: duplicate() returns typed instance for this class

`create-or-duplicate.md` warns that `Resource.duplicate()` returns a generic
`Resource`, not the subclass. **For `TimecodeTransportLtc` this is wrong** —
the probe confirmed that `template.duplicate(path)` returns a
`TimecodeTransportLtc` directly, with all typed properties accessible. No
re-load via `resourceManager.load()` is required, although re-loading also
works and is harmless.

This deviation may not generalise to other types. When in doubt, re-load.

## Save / package side effects

Each `duplicate()` call writes the resource to disk
(`Saving objects/timecodetransportltc/<name>.apx`). Each `remove()` removes
it from the package. Cost: ~100ms per pair. Bulk operations should batch
where possible.

## Related

- [create-or-duplicate.md](create-or-duplicate.md) — general resource creation pattern
- [transport-manager-access.md](transport-manager-access.md) — how to find the TransportManager that holds the active timecode selection
- [transport-commands.md](transport-commands.md) — playback control patterns
- `reference-tools/probe_audioline_lifecycle.py` — same pattern for `AudioLine`
