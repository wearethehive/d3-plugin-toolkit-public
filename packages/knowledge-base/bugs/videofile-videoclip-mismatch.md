---
type: bug
status: confirmed
severity: critical
tested: "2026-03-15"
crashers:
  - pattern: "d3\\.VideoFile\\b"
    message: "d3.VideoFile in indirection controllers causes PROJECT CORRUPTION. Use d3.VideoClip instead."
    severity: critical
---

# VideoFile vs VideoClip type mismatch

## Description

When configuring indirection controllers for video layers, the `resources` array expects **VideoClip** type, not **VideoFile**. Using `d3.VideoFile` or `resourceManager.allResources(d3.VideoFile)` to populate the controller causes cascading errors.

## Symptoms

```
test_ctrl returned an object of type: VideoFile for indirection of type VideoClip
```

This message repeats hundreds of times per second in d3Log, eventually cascading into:
- ACCESS_VIOLATION errors
- `Cannot convert from 'SuperLayer' to 'Layer'` errors
- Full project corruption requiring project deletion

## Root Cause

Video layer indirections use a VideoClip pipeline internally. The controller's resources must match that expected type.

## Workaround

Use `d3.VideoClip` (or the correct clip type) instead of `d3.VideoFile` when populating controller resources. The exact resolution for looking up VideoClip resources by media file name needs further investigation.

## Impact

This bug caused catastrophic project failure during development of the video-layer-manager plugin.
