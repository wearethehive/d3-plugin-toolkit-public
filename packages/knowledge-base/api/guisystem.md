---
type: api
status: works
tested: "2026-03-15"
---

# guisystem

## Access

`guisystem` is a pre-injected global in the Python execution environment.

**DO NOT** use `state.track` — it causes HTTP 500.

## Properties

### guisystem.track

**Status**: WORKS

Returns the current Track object.

```python
track = guisystem.track
layers = track.layers
```

### guisystem.currentTransportManager

**Status**: WORKS (tested 2026-03-22)

Returns the current TransportManager. See `api/transport.md` for full details.

```python
tm = guisystem.currentTransportManager
player = tm.player
t = player.tCurrent  # playhead in beats (beats = seconds in d3)
```

### guisystem.player.tCurrent

**Status**: WORKS (tested 2026-05-04, re-confirmed)

Returns current playhead time as float. Both paths work:

```python
# Via transport manager (preferred when issuing transport commands)
t = guisystem.currentTransportManager.player.tCurrent

# Direct shortcut (also confirmed safe 2026-05-04)
t = guisystem.player.tCurrent
```

## Other Globals

### trackTime()

**Status**: WORKS

Returns playhead position in seconds.

```python
t = trackTime()
```

### runningTime()

**Status**: UNTESTED

Returns application runtime in seconds.
