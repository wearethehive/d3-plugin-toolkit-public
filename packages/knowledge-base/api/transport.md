---
type: api
status: works
tested: "2026-03-22"
---

# Transport API

## Access

```python
tm = guisystem.currentTransportManager
player = tm.player
```

## TransportCommand & PlayMode

Both `d3.TransportCommand` and bare `TransportCommand` work in registered modules.
Both `d3.PlayMode` and bare `PlayMode` work. Current convention: use `d3.` prefix.

```python
import d3
cmd = d3.TransportCommand.makePlayMode(None, tm, d3.PlayMode(0))
tm.addCommand(cmd)
```

### PlayMode Values

| Value | Mode |
|-------|------|
| 0 | Play |
| 1 | PlaySection |
| 2 | LoopSection |
| 3 | Stop |
| 4 | HoldSection |
| 5 | HoldEnd |

### Other Commands

```python
d3.TransportCommand.makeNudgeSection(None, tm, 1)   # next section
d3.TransportCommand.makeNudgeSection(None, tm, -1)  # prev section
d3.TransportCommand.makeJumpToBeat(None, tm, 0.0)   # jump to beat
```

## tm.engaged

**Status**: WORKS — persists between calls

Transport must be engaged before commands work:

```python
tm.engaged = True  # persists — no need to re-set each call
```

## player.tCurrent / tRender

**Status**: WORKS (returns float, beats = seconds in d3)

```python
t = player.tCurrent  # current playhead position in beats/seconds
t = player.tRender   # frame-quantized position (use for display)
```

**For real-time display**: Use `liveUpdate.subscribe('transportManager:default', ...)`
with `object.player.tRender` instead of polling. See `patterns/liveupdate-subscribe.md`.

## Switching tracks on the live transport

Use `makeNudgeTrack` to step through the transport's `setList`:

```python
import d3

tm = guisystem.currentTransportManager
setlist_paths = [str(t.path) for t in tm.setList.tracks]
current_path = str(tm.track.path) if tm.track else ''
target_path = 'objects/track/my_track.apx'

if target_path in setlist_paths and current_path in setlist_paths:
    delta = setlist_paths.index(target_path) - setlist_paths.index(current_path)
    if delta != 0:
        tm.addCommand(TransportCommand.makeNudgeTrack(0, tm, delta))

tm.addCommand(TransportCommand.makeJumpToBeat(0, tm, target_beat))
```

**`trackToLoad` setter does NOT switch the active track during a live session.**
It only sets the default track loaded before any commands are received.
`makeNudgeTrack` is the correct command-based approach (confirmed 2026-05-04).

The target track must appear in `tm.setList.tracks`; tracks not in the setList
cannot be reached via this transport manager.

## player.playing / player.stopped

**Status**: WORKS

```python
player.playing   # bool — True during playback
player.stopped   # bool — True when stopped
```

**Subscribable** via `object.player.playing` / `object.player.stopped`.
