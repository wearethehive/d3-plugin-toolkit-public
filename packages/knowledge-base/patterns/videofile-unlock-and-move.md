---
type: pattern
status: confirmed
tested: "2026-05-07"
scope: python-api
api_coverage:
  - name: "VideoFile.unlockFile"
    match: "unlockFile|moveToTrash|emptyTrash"
    related_files: ["videofile-unlock-and-move.md", "video-content-management.md"]
    required: false
---

# VideoFile Unlock and Move

## Handle Release — unlockFile() vs moveToTrash()

Designer holds open file handles on all loaded media for fast playback.
Moving or deleting a file while Designer has a handle will fail with
`[Error 32] The process cannot access the file`.

Two APIs release handles, but they work differently:

| API | Releases image handle | Releases video decoder handle | Side effect |
|---|---|---|---|
| `vf.unlockFile()` | ✓ | ✗ | File stays on disk |
| `vf.moveToTrash()` | ✓ | ✓ | File moved to `trash/<rel_path>` |

**For `.mov` and other video files, `unlockFile()` is not enough.**
The video decoder holds a separate streaming handle that only `moveToTrash()`
releases.

## Two-Stage Move Strategy

To move a file to a staging folder while Designer is running:

```python
import os, shutil

cwd = os.getcwd()

# Stage 1: try unlockFile() + rename (works for images)
try:
    vf.unlockFile()
    os.rename(src_abs, dst_abs)
    # success — done
except BaseException as e:
    if '[Error 32]' not in str(e) and 'used by another process' not in str(e):
        raise

    # Stage 2: moveToTrash() then rescue from trash/ (works for all types)
    vf_rel = str(vf.path).replace('\\', '/')      # e.g. objects/VideoFile/show/file.mov
    trash_src = os.path.join(cwd, 'trash', vf_rel.replace('/', os.sep))
    vf.moveToTrash()
    if os.path.isfile(trash_src):
        os.rename(trash_src, dst_abs)
```

`vf.path` is the relative path **including extension**
(e.g. `objects/VideoFile/show/file.mov`). The trash location mirrors that
relative path exactly under `<project>/trash/`.

## Staging Folder Must Be Outside objects/VideoFile/

If the staging folder is a subdirectory of `objects/VideoFile/`, Designer
re-scans it, re-loads the files, and re-acquires handles — defeating the unlock.

```python
# WRONG — Designer will re-lock these
pending = os.path.join(cwd, 'objects', 'VideoFile', '_pending')

# CORRECT — outside scan scope, Designer ignores it
pending = os.path.join(cwd, '_plugin_pending')
```

Any folder at the project root (sibling of `objects/`) is safe.

## Permanent Deletion via emptyTrash

To permanently delete resources that have been moved to trash:

```python
import d3
files_to_purge = resourceManager.allResources(d3.VideoFile)
# filter to the ones you want gone, then:
resourceManager.emptyTrash(files_to_purge)
```

## consolidateAllClips() Is Dangerous

Do **not** call `consolidateAllClips()` for targeted file operations.
It triggers Designer's "Upgrading Video Files" process across the **entire
project**, not just the files you intend to touch. There is no scoped version.
