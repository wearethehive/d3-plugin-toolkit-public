---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "VideoClip"
    match: "\\bVideoClip\\b"
    related_files: ["video-content-management.md"]
    required: false
  - name: "VideoFile"
    match: "\\bVideoFile\\b"
    related_files: ["video-content-management.md"]
    required: false
---

# Video Content Management

## Resource Model

Designer uses two related content surfaces:

| Surface | What it is | Example |
|---|---|---|
| `VideoFile` | Raw media file under the project folder | `objects/VideoFile/content/scene_v001.mov` |
| `VideoClip` | Designer resource assigned to layers | `objects/videoclip/content/scene.mov.apx` |

VideoClips are auto-created when media appears in `objects/VideoFile/`. Query
`resourceManager.allResources(VideoClip)` for layer-assignable resources.

## Active Project Path

Inside Designer Python, `os.getcwd()` returns the active project folder.
`ProjectPathsManager` returns the projects root, not the active project.

```python
import os

project_dir = os.getcwd()
video_file_dir = os.path.join(project_dir, "objects", "VideoFile")
```

## Importing Local Media

To ingest generated or external media into the active project:

1. Ask Designer for `os.getcwd()` from inside the running project.
2. Copy the source file into `objects/VideoFile/<subfolder>/`.
3. Create or load the corresponding `VideoClip` at
   `objects/videoclip/<subfolder>/<filename>.apx`.

Avoid creating project folders from inside Designer Python if a safer host-side
copy step is available. `os.makedirs()` inside the project folder has separate
crasher history; prefer doing filesystem setup from Node/CLI and only using
Designer Python to register or load resources.

## VideoClip Properties

```python
clips = resourceManager.allResources(VideoClip)
clip = clips[0]

info = {
    "name": clip.description,
    "path": str(clip.path),
    "resolution": [int(clip.fileFrameSize.x), int(clip.fileFrameSize.y)],
    "version": clip.enabledVersion,
    "fps": clip.fileFps,
    "frames": clip.fileNFrames,
    "hasAudio": bool(clip.hasAudio),
    "proxyInfo": clip.proxyInfo,
    "dataRate": clip.dataRate,
    "isVideoIn": bool(clip.isVideoIn),
    "speed": clip.speed,
    "frame_blending": clip.frame_blending,
    "clip_type": clip.clip_type,
}
```

`clip.file` exposes backing file metadata when available:

```python
if clip.file:
    bit_depth = clip.file.bitDepth
    codec = clip.file.codec
```

## Settable Clip Properties

```python
clip.frame_blending = 1  # 0=Off, 1=On, 2=Auto
clip.clip_type = 1       # 0=Clip, 1=Fit, 2=Stretch, 3=Pixel-perfect
clip.speed = 1.0
```

## Versioning Pattern

For versioned content, keep the VideoClip path unversioned and drop new
versioned VideoFiles on disk:

1. Copy raw file as `objects/VideoFile/content/scene_v001.mov`.
2. Register or reference `objects/videoclip/content/scene.mov.apx`.
3. Assign the unversioned VideoClip resource to layers once.
4. Add `scene_v002.mov` later; Designer resolves the latest version.

`enabledVersion` reports the active version. An empty `enabledVersion` means
there is no backing file, or the clip is a live/video-input style resource.

## Bulk Layer Resource Swaps

For a dry-run capable swap tool:

```python
track = guisystem.track
for layer_i in range(len(track.layers)):
    layer = track.layers[layer_i]
    leaves = layer.getLeafLayers()
    for leaf_i in range(len(leaves)):
        leaf = leaves[leaf_i]
        field = leaf.findSequence("video")
        if field is None:
            continue
        seq = field.sequence
        for key_i in range(seq.nKeys()):
            beat = seq.t(key_i)
            value = field.getSequencedValue(beat)
            if not value or not hasattr(value.value, "path"):
                continue
            current_path = str(value.value.path)
            # choose replacement path from a user-supplied map
            new_res = resourceManager.load(replacement_path, VideoClip)
            seq.setResource(beat, new_res)
        field.notifyEdit()
```

Always load replacement resources with a type argument. See
`timeline-import-resources.md`.

## Finding Where Media Is Used

`MappedMediaDomain.findResourceUsage(video_clip)` can report layer usage for a
`VideoClip`. Useful fields on each usage location include the mapping type,
track, layer, content-bank slot, and sequencing range. For user-facing reports,
combine that with cue lookup at `location.contentSequencingStart` so media usage
can be grouped by section/cue.

Known mapping type labels observed in usage results:

| Value | Meaning |
|---|---|
| `0` | Sequencing |
| `1` | Sockpuppet |
| `2` | ModuleConfig |

When reporting video field keys directly, walk leaf layers, find the `video`
sequence, and read each key time with `field.getSequencedValue(t)`.

## Read Active Video Resource at a Beat

For cue-preview or blind-mode UIs, resolve the `video` sequence value for a
layer at a target beat instead of only reading key 0.

```python
def video_resource_at_beat(layer, beat):
    field = layer.findSequence("video")
    if field is None or field.sequence is None or field.sequence.nKeys() == 0:
        return None

    resource = None
    try:
        # Walk keys and keep the last resource at or before the target beat.
        count = int(field.sequence.nKeys())
        for index in range(count):
            try:
                if float(field.sequence.t(index)) <= float(beat):
                    resource = getattr(field.sequence.key(index), "r", None)
            except:
                pass
    except:
        pass

    if resource is None:
        try:
            resource = getattr(field.sequence.key(0), "r", None)
        except:
            resource = None

    return resource
```

When converting the returned resource path for file/thumbnail matching, strip
either `objects/videoclip/` or `objects/videofile/`, and remove a trailing
`.apx`. Live inputs may look like `videoin_N.mov`, `sdi_in_N.mov`, or
`capture_in_N.mov`; treat those as labels rather than file-backed media.
