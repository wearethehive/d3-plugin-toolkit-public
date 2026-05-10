---
type: pattern
status: confirmed
tested: "2026-05-03"
api_coverage:
  - name: "ThumbnailSystem"
    match: "ThumbnailSystem"
    related_files: ["media-thumbnail-extraction.md"]
    required: false
  - name: "getTemporaryVideoFileThumbnail"
    match: "getTemporaryVideoFileThumbnail\\s*\\("
    related_files: ["media-thumbnail-extraction.md"]
    required: false
  - name: "getThumbnail"
    match: "getThumbnail\\s*\\("
    related_files: ["media-thumbnail-extraction.md"]
    required: false
---

# Media Thumbnail Extraction

## Purpose

Create a still thumbnail image for an existing `VideoFile` resource and save it
to disk from Designer Python.

This is confirmed against a live Designer project with media loaded. The probe
selected one of 15 `VideoFile` resources and saved a non-empty JPG.

## Important Stub Gap

`ThumbnailSystem`, `getTemporaryVideoFileThumbnail`, and `getThumbnail` are not
present in `packages/shared/d3.pyi`, but they are available in the live Designer
Python global namespace. This pattern is allowed because it has a focused live
probe: `reference-tools/probe_media_thumbnail_extraction.py`.

Do not infer other thumbnail APIs from naming. Probe them first.

## Pattern

```python
import os

VideoFile = globals().get("VideoFile")
ThumbnailSystem = globals().get("ThumbnailSystem")

video_files = resourceManager.allResources(VideoFile)
video_file = video_files[0]

thumbnails = subsystems.getSystem(ThumbnailSystem)

texture = None
try:
    texture = thumbnails.getTemporaryVideoFileThumbnail(video_file, 0)
except:
    texture = None

if texture is None:
    texture = thumbnails.getThumbnail(video_file)

texture.download(True)
texture.saveFile(output_path)
```

## Robust Version

```python
def save_video_file_thumbnail(video_file, output_path):
    thumbnails = None
    try:
        thumbnails = subsystems.getSystem(ThumbnailSystem)
    except:
        thumbnails = None

    if thumbnails is None:
        return {"ok": False, "reason": "thumbnail-system-unavailable"}

    texture = None
    method = ""

    try:
        texture = thumbnails.getTemporaryVideoFileThumbnail(video_file, 0)
        if texture is not None:
            method = "getTemporaryVideoFileThumbnail"
    except:
        texture = None

    if texture is None:
        try:
            texture = thumbnails.getThumbnail(video_file)
            if texture is not None:
                method = "getThumbnail"
        except:
            texture = None

    if texture is None:
        return {"ok": False, "reason": "thumbnail-texture-null"}

    try:
        texture.download(True)
    except:
        pass

    try:
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.isdir(output_dir):
            os.makedirs(output_dir)
    except:
        return {"ok": False, "reason": "mkdir-failed"}

    try:
        texture.saveFile(output_path)
    except:
        return {"ok": False, "reason": "save-file-failed"}

    try:
        size = os.path.getsize(output_path)
    except:
        size = 0

    return {
        "ok": size > 0,
        "method": method,
        "path": output_path,
        "size": int(size),
    }
```

## Confirmed Result

Probe file: `packages/knowledge-base/reference-tools/probe_media_thumbnail_extraction.py`

Live run:

```json
{
  "ok": true,
  "videoFileCount": 15,
  "thumbnailSystemClass": "ThumbnailSystem",
  "textureClass": "Texture",
  "textureMethod": "getThumbnail",
  "downloadCalled": true,
  "saved": {
    "path": "d:/d3 projects/plugintesting/codex_probe_output/thumbnail_probe.jpg",
    "size": 2046
  },
  "cleanup": "temporary jpg and output folder removed"
}
```

The first attempted method, `getTemporaryVideoFileThumbnail(video_file, 0)`,
entered Designer's thumbnail path and produced a d3 log warning about early
render access. The probe then fell back to `getThumbnail(video_file)`, which
returned a `Texture` that saved successfully.

## d3 Log Warning

The confirmed run emitted:

```text
Main thread hung due to early render access ... ThumbnailSystem::getTemporaryVideoFileThumbnail
```

Designer recovered immediately and the script completed in about 21 ms. Treat
thumbnail generation as render-adjacent work: do it on explicit user action or
small batches, not tight polling loops.

