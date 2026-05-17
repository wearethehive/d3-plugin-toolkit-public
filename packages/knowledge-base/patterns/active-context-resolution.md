---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "LocalState.localState"
    match: "LocalState\\.localState\\s*\\("
    related_files: ["active-context-resolution.md", "transport-manager-access.md"]
    required: false
  - name: "guisystem.currentTransportManager"
    match: "guisystem\\.currentTransportManager"
    related_files: ["active-context-resolution.md", "transport-manager-access.md"]
    required: false
  - name: "guisystem.track"
    match: "guisystem\\.track"
    related_files: ["active-context-resolution.md", "cuelist-query.md"]
    required: false
---

# Active Track, Transport, and Player Resolution

## Purpose

Different Designer Python execution contexts expose the active show state through
slightly different globals. For tools that run through `/api/session/python/execute`,
resolve active objects with a small fallback ladder and return which path worked.

This is useful for UI tools that need to read the current track, move the
playhead, or create layers at the current transport position.

## Track Resolution

```python
def resolve_track():
    try:
        local_state = LocalState.localState()
        track = getattr(local_state, "track", None)
        if track is not None:
            return track, "LocalState.localState().track"
    except:
        pass

    try:
        track = getattr(guisystem, "track", None)
        if track is not None:
            return track, "guisystem.track"
    except:
        pass

    try:
        players = resourceManager.allResources(TrackPlayer)
        if players:
            track = getattr(players[0], "track", None)
            if track is not None:
                return track, "TrackPlayer.track"
    except:
        pass

    return None, ""
```

## Transport Manager Resolution

```python
def resolve_transport_manager():
    try:
        manager = getattr(guisystem, "currentTransportManager", None)
        if manager is not None:
            return manager, "guisystem.currentTransportManager"
    except:
        pass

    try:
        local_state = LocalState.localState()
        transport = getattr(local_state, "transport", None)
        current = getattr(transport, "current", None)
        if current is not None:
            return current, "LocalState.localState().transport.current"
    except:
        pass

    return None, ""
```

## Player Resolution

```python
def resolve_player():
    try:
        player = LocalState.localState().transport.current.player
        if player is not None:
            return player, "LocalState.localState().transport.current.player"
    except:
        pass

    try:
        player = getattr(guisystem, "player", None)
        if player is not None:
            return player, "guisystem.player"
    except:
        pass

    return None, ""
```

## Notes

- Prefer `guisystem.currentTransportManager` for transport commands when it is
  present; it is already a confirmed path in `transport-manager-access.md`.
- `LocalState.localState().track` and `LocalState.localState().transport.current`
  are visible in the stub and observed in working code, but need a focused probe
  in this repo before marking them confirmed.
- Use bare `except:` around these lookups because Designer binding failures do
  not always subclass `Exception`.
