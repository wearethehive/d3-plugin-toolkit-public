---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "VideoClip resource placement"
    match: "setResource\\s*\\([^\\)]*VideoClip"
    related_files: ["video-layer-placement.md", "timeline-import-resources.md"]
    required: false
---

# Video Layer Placement With Resource Matching

## Purpose

Create a video layer at the current playhead, resolve a matching `VideoClip`,
and set the layer's `video` key. Optionally infer a mapping token from the media
name and set the `mapping` key to a matching projection.

## Duration Conversion

Track extents are beats. Convert a desired second duration through the track so
non-60 BPM projects keep the intended real-time length.

```python
time_start = float(LocalState.localState().currentTransport.player.tCurrent)
duration_seconds = 60.0

start_seconds = float(track.beatToTime(time_start))
end_beat = float(track.timeToBeat(start_seconds + duration_seconds))
duration_beats = max(0.001, end_beat - time_start)
```

## Create a Plain Video Layer

```python
new_layer = track.addNewLayer(VariableVideoModule, time_start, duration_beats, layer_name)
try:
    new_layer.name = layer_name
except:
    pass
```

## Match a VideoClip Resource

```python
import re

def canonical_video_token(value):
    try:
        token = str(value).replace("\\", "/").strip().lower()
    except:
        return ""

    token = token.replace("/videofile/", "/videoclip/")
    if token.endswith(".apx"):
        token = token[:-4]
    token = re.sub(r"\.(mov|mp4|mxf|avi|m4v|wmv|mpg|mpeg|mkv)$", "", token)
    token = re.sub(r"_v\d+(?=\.[a-z0-9]+$)", "", token)
    token = re.sub(r"_v\d+$", "", token)
    return token

def resource_tokens(resource):
    variants = []
    for attr in ("description", "path"):
        try:
            variants.append(getattr(resource, attr))
        except:
            pass
    try:
        variants.append(resource.path.filename)
        variants.append(resource.path.lastDirectory + "/" + resource.path.filename)
    except:
        pass
    return [canonical_video_token(v) for v in variants if canonical_video_token(v)]

def resource_matches_input(resource, input_path):
    needle = canonical_video_token(input_path)
    if not needle:
        return False
    needle_base = needle.split("/")[-1]
    for candidate in resource_tokens(resource):
        candidate_base = candidate.split("/")[-1]
        if candidate == needle:
            return True
        if candidate.endswith("/" + needle):
            return True
        if needle.endswith("/" + candidate):
            return True
        if needle_base and candidate_base == needle_base:
            return True
    return False

def find_video_clip(input_path):
    try:
        clips = resourceManager.allResources(VideoClip)
    except:
        clips = []

    try:
        count = int(len(clips))
    except:
        count = 0

    for index in range(count):
        try:
            clip = clips[index]
            if resource_matches_input(clip, input_path):
                return clip
        except:
            pass
    return None
```

## Set the Video Key

```python
clip = find_video_clip(clip_path)
if clip is None:
    return {"ok": False, "error": "Video resource not found"}

field = new_layer.findSequence("video")
if field is None or field.sequence is None:
    return {"ok": False, "error": "Video sequence not found"}

field.sequence.setResource(float(new_layer.tStart), clip)
field.notifyEdit()
track.saveOnDelete()
```

## Optional Mapping Token

```python
def mapping_token_from_clip_name(clip_name):
    base = str(clip_name or "").replace("\\", "/").split("/")[-1]
    stem = base.rsplit(".", 1)[0] if "." in base else base
    parts = [p for p in stem.split("_") if p]
    if len(parts) < 3:
        return ""
    tail = parts[-1]
    if re.match(r"^v\d+$", tail, re.IGNORECASE):
        return parts[-2] if len(parts) >= 3 else ""
    return tail

def find_projection_by_description(token):
    needle = canonical_video_token(token)
    for cls in (Projection, DirectProjection, FeedProjection):
        try:
            mappings = resourceManager.allResources(cls)
        except:
            mappings = []

        try:
            count = int(len(mappings))
        except:
            count = 0

        for index in range(count):
            try:
                mapping = mappings[index]
                if canonical_video_token(mapping.description) == needle:
                    return mapping
            except:
                pass
    return None
```

Use `mapping`'s `ResourceSequence.setResource(layer.tStart, projection_or_None)`
and `notifyEdit()` as in `layer-mapping-assignment.md`.

## Template Layer Caveat

The working sample also used `track.addLayer(template_super_layer, beat, index)`
to place a copied template layer and handled `None` returns by diffing
`track.layers` before/after insertion. This conflicts with the repo's confirmed
`bugs/addLayer-crash.md`, so do **not** adopt that path without a fresh isolated
probe on the exact Designer build. The safe local default remains
`track.addNewLayer(ModuleType, start, length, name)`.
