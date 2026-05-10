---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "TransportCommand.makeJumpToTime"
    match: "TransportCommand\\.makeJumpToTime\\s*\\("
    related_files: ["transport-playhead-and-section-navigation.md", "transport-commands.md"]
    required: false
  - name: "TransportCommand.makeNudgeSection"
    match: "TransportCommand\\.makeNudgeSection\\s*\\("
    related_files: ["transport-playhead-and-section-navigation.md", "transport-commands.md"]
    required: false
---

# Transport Playhead and Section Navigation

## Purpose

Move the active playhead by beat, seconds, or section while tolerating variation
in which active transport/player globals are available.

Use the object resolution helpers from `active-context-resolution.md`.

## Jump to Beat or Seconds

```python
target_beat = float(beat_value)
target_seconds = seconds_value  # None or float

manager, manager_source = resolve_transport_manager()
if manager is not None:
    try:
        source = state
    except:
        source = 0

    command = None
    if target_seconds is not None:
        try:
            command = TransportCommand.makeJumpToTime(source, manager, float(target_seconds))
        except:
            command = None

    if command is None:
        try:
            command = TransportCommand.makeJumpToBeat(source, manager, target_beat)
        except:
            command = None

    if command is not None:
        manager.addCommand(command)
        player, player_source = resolve_player()
        if player is not None:
            try:
                return {"ok": True, "beat": float(player.tCurrent), "source": manager_source}
            except:
                pass
        return {"ok": True, "beat": target_beat, "source": manager_source}

player, player_source = resolve_player()
if player is not None:
    player.tCurrent = target_beat
    return {"ok": True, "beat": target_beat, "source": player_source}

return {"ok": False, "error": "No transport manager or player available"}
```

## Previous Section

```python
manager, manager_source = resolve_transport_manager()
track, track_source = resolve_track()
player, player_source = resolve_player()

if manager is None or track is None or player is None:
    return {"ok": False, "error": "Missing transport, track, or player"}

try:
    current_beat = float(player.tCurrent)
except:
    current_beat = 0.0

try:
    source = state
except:
    source = 0

command = None
try:
    command = TransportCommand.makeNudgeSection(source, manager, -1)
except:
    command = None

if command is not None:
    manager.addCommand(command)
    return {"ok": True, "beat": float(player.tCurrent), "source": manager_source}

section_count = int(track.nSections())
current_section = int(track.beatToSection(current_beat))
target_section = current_section - 1
if target_section < 0:
    return {"ok": False, "error": "Already at first section", "beat": current_beat}

target_beat = float(track.sectionToBeat(target_section))
command = TransportCommand.makeJumpToBeat(source, manager, target_beat)
manager.addCommand(command)
return {"ok": True, "beat": float(player.tCurrent), "targetBeat": target_beat}
```

## Next Section

The next-section path is the same shape with:

```python
target_section = int(track.beatToSection(current_beat)) + 1
if target_section >= int(track.nSections()):
    return {"ok": False, "error": "Already at final section", "beat": current_beat}

target_beat = float(track.sectionToBeat(target_section))
command = TransportCommand.makeNudgeSection(source, manager, 1)
if command is None:
    command = TransportCommand.makeJumpToBeat(source, manager, target_beat)
manager.addCommand(command)
```

## Notes

- Create a fresh `TransportCommand` for every action, then execute it with
  `manager.addCommand(command)`.
- Prefer command-based moves. Direct `player.tCurrent = beat` is only a fallback
  when no transport manager/command path is available.
- `makeJumpToTime` can be tried first when the UI already has a second value;
  fall back to `makeJumpToBeat` if it returns `None` or raises.

