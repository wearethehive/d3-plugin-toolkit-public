---
type: bug
status: confirmed
tested: "2026-05-07"
severity: silent-failure
scope: python-api
api_coverage:
  - name: "VideoFile.description"
    match: "\\bVideoFile\\b.*description|description.*\\bVideoFile\\b"
    related_files: ["videofile-unlock-and-move.md", "video-content-management.md"]
    required: false
---

# VideoFile.description Has No File Extension

## Summary

`d3.VideoFile.description` returns the filename **without its extension**.
`d3.VideoFile.path` returns the relative path **with** the extension.

| Property | Example value |
|---|---|
| `vf.description` | `"testgrid_v7"` |
| `vf.path` | `"objects/VideoFile/show/testgrid_v7.png"` |

## Why It Matters

Any code that tries to match a filename on disk (which includes the extension)
against `vf.description` will silently never match. This affects unlock
operations, version detection, and any filename-to-resource lookup.

## The Fix

Always try both the bare name and the name with extension stripped when matching
descriptions to filenames:

```python
import os

def _make_name_set(abs_path):
    fname = os.path.basename(abs_path)
    fname_lower = fname.lower()
    dot = fname_lower.rfind('.')
    name_no_ext = fname_lower[:dot] if dot > 0 else fname_lower
    return {fname_lower, name_no_ext}

# When matching against vf.description:
desc_lower = vf.description.lower() if vf.description else ''
names = _make_name_set(abs_path)
if desc_lower in names:
    # matched
```

Or when building a lookup map from VideoFile objects, key by both forms:

```python
vf_by_name = {}
for vf in resourceManager.allResources(d3.VideoFile):
    desc = (vf.description or '').lower()
    vf_by_name[desc] = vf          # no-extension form (what Designer stores)
    # Also index by basename-no-ext of path for safety
    bn = os.path.basename(str(vf.path)).lower()
    dot = bn.rfind('.')
    if dot > 0:
        vf_by_name[bn[:dot]] = vf
```

## Root Cause

Designer strips extensions when creating the description field for VideoFile
resources. This is consistent across all media types (`.mov`, `.png`, `.mp4`
etc.). It is not a bug that will be fixed; match accordingly.
