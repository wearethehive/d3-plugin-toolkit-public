---
type: pattern
status: documented
---

# Transport Commands

## Core Pattern: Create Then Execute

TransportCommand uses a factory pattern. Commands do NOTHING until `addCommand()` is called.

```python
transport_manager = guisystem.currentTransportManager

# Step 1: Create command via factory method
cmd = TransportCommand.makeJumpToBeat(state, transport_manager, 32.0)

# Step 2: Execute — nothing happens without this call
transport_manager.addCommand(cmd)
```

## Available Command Factories

All factory methods take `(state, transport_manager, ...)` as the first two arguments.

```python
# Jump to specific beat position
cmd = TransportCommand.makeJumpToBeat(state, transport_manager, beat_position)

# Jump to cue (xx, yy, zz are cue coordinates; cue_mode controls behavior)
cmd = TransportCommand.makeJumpToCue(state, transport_manager, xx, yy, zz, cue_mode)

# Playback mode (play, pause, stop)
cmd = TransportCommand.makePlayMode(state, transport_manager, mode)

# Set playback speed (1.0 = normal)
cmd = TransportCommand.makeSetSpeed(state, transport_manager, 1.0)

# Master brightness (0.0 to 1.0)
cmd = TransportCommand.makeBrightness(state, transport_manager, 0.8)

# Master volume (0.0 to 1.0)
cmd = TransportCommand.makeVolume(state, transport_manager, 0.5)

# Relative navigation
cmd = TransportCommand.makeNudgeBeat(state, transport_manager, delta)
cmd = TransportCommand.makeNudgeSection(state, transport_manager, delta)
cmd = TransportCommand.makeNudgeTrack(state, transport_manager, delta)
```

## Timecode Transport

First obtain a transport manager. `guisystem.transportManager` is **not**
exposed in the sandbox (see [transport-manager-access.md](transport-manager-access.md)).
Use one of:

```python
import d3
transport_manager = guisystem.currentTransportManager           # active one
# or, to enumerate all:
transport_manager = resourceManager.allResources(d3.TransportManager)[0]
```

Then read timecode state:

```python
tc_transport = transport_manager.timecode    # TimecodeTransport or None
tc_status = tc_transport.updateStatusString   # human-readable status
tc_type = tc_transport.SMPTE_clock_type       # SMPTE type identifier
tc_now = str(tc_transport.current)            # live timecode value
```

`transport_manager.timecode` is settable — assignment round-trip is
confirmed by `reference-tools/probe_timecode_assign.py`.

## Common Patterns

### Jump to start of track and play
```python
transport_manager = guisystem.currentTransportManager
cmd = TransportCommand.makeJumpToBeat(state, transport_manager, 0.0)
transport_manager.addCommand(cmd)
cmd = TransportCommand.makePlayMode(state, transport_manager, mode)
transport_manager.addCommand(cmd)
```

### Fade to black via master brightness
```python
transport_manager = guisystem.currentTransportManager
cmd = TransportCommand.makeBrightness(state, transport_manager, 0.0)
transport_manager.addCommand(cmd)
```

## Key Notes
- `guisystem.currentTransportManager` is the entry point - always available as a global
- Commands are ephemeral - create a new one each time, do not reuse
- `PlayMode(0)` has been used for play, `PlayMode(2)` for loop/current-section
  playback, and `PlayMode(3)` for stop. Keep these behind probes when changing
  transport behavior because mode enums are host-version sensitive.
