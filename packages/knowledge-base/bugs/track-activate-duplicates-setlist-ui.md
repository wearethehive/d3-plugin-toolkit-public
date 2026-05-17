---
type: bug
status: confirmed
tested: "2026-05-16"
severity: warning
api_coverage:
  - name: "Track.activate"
    match: "\\.activate\\s*\\("
    related_files: []
    required: false
  - name: "Track loadOrCreate"
    match: "loadOrCreate\\s*\\([^\\n]*d3\\.Track"
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

## Missing-path load before create can dirty the creation transaction

The original workaround above used `resourceManager.load(path, d3.Track)` before
`loadOrCreate(path, d3.Track)`. That is safe when the resource exists, but a
SmartGroups manual test on 2026-05-16 showed a bad create transaction when the
path was missing:

```text
ResourceLoader::load : file objects/track/999_templates.apx not found !!!
! IdentityDomain: Resource objects/track/999_templates.apx added and loaded in same transaction
```

Designer then showed the new template track in red during the manual test. A
follow-up status probe after Designer settled reported the resource was no
longer bad/incomplete/in-error, so the red state appears tied to the creation
transaction rather than persistent track data.

For plugin-created Tracks, prefer checking the loaded Track resource inventory
first, then only create when no matching Track is already present:

```python
def find_template_track():
    tracks = resourceManager.allResources(d3.Track)
    for i in range(len(tracks)):
        track = tracks[i]
        if str(track.path) == "objects/track/999_templates.apx":
            return track
    return None

track = find_template_track()
if track is None:
    track = resourceManager.loadOrCreate("objects/track/999_templates.apx", d3.Track)
    track.notifyCreate()
    markDirty(track)
    track.lengthInBeats = float(guisystem.track.lengthInBeats)
    track.bpm = float(guisystem.track.bpm)

markDirty(track)
track.save()
```

Avoid global `resourceManager.saveAll()` in this create flow; the failing manual
test also surfaced an unrelated `internal/gui/stickymanager.json` write error
while saving all resources.
