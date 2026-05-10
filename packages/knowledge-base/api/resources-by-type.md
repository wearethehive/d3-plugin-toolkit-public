---
type: api
status: works
tested: "2026-03-22"
---

# allResources() by Type

## Usage

```python
import d3
items = resourceManager.allResources(d3.SomeType)
for i in range(len(items)):
    item = items[i]
    path = str(item.path)
    name = str(item.description)
```

## Tested Types

### d3.TextFont

**Status**: WORKS (conditional)

Returns 0 results unless at least one text layer exists in the project.
Once a text layer is present, returns available fonts.

```python
fonts = resourceManager.allResources(d3.TextFont)
# path: "objects/text/Arial.apx"
# description: "arial" (lowercase)
```

### d3.LogicalAudioOutDevice

**Status**: WORKS

```python
outputs = resourceManager.allResources(d3.LogicalAudioOutDevice)
# path: "objects/logicalaudiooutdevice/default.apx"
# description: "default"
```

### d3.VideoClip

**Status**: WORKS

Paths follow: `objects/videoclip/<subfolder>/<name>.apx`

```python
clips = resourceManager.allResources(d3.VideoClip)
# path: "objects/videoclip/nh_testfiles_29012016/map4_holdingearth.mov.apx"
# description: "map4_holdingearth.mov"
```

### d3.Track

**Status**: WORKS — consistent ordering

```python
tracks = resourceManager.allResources(d3.Track)
# path: "objects/track/track 1.apx"
# description: "track 1"
```

## Cue / Section Notes

```python
track = guisystem.track
player = guisystem.currentTransportManager.player
cue = track.cueAtBeat(player.tCurrent)

if cue is not None:
    note = cue.getNote()  # returns str, empty string "" if no note (never None)
```
