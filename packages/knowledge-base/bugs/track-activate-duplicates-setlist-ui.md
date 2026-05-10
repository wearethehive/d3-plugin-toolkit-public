---
type: bug
status: observed
tested: "2026-05-04"
severity: warning
api_coverage:
  - name: "Track.activate"
    match: "\\.activate\\s*\\("
    related_files: []
    required: false
---

# Track.activate can duplicate Track dialog rows

Calling `activate()` on an existing `d3.Track` from plugin Python can make the
Track dialog show repeated rows for the same track name. Live probes after the
issue showed only one `Track` resource at `objects/track/999_templates.apx` and
only one entry in `guisystem.currentTransportManager.setList.tracks`, so the
duplicates appear to be GUI/set-list presentation rows rather than duplicate
Track resources.

For plugin-created tracks, prefer:

```python
track = resourceManager.load(path, d3.Track)
if track is None:
    track = resourceManager.loadOrCreate(path, d3.Track)
markDirty(track)
track.saveOnDelete()
resourceManager.saveAll()
```

Do not call `track.activate()` as part of idempotent create/load flows.
