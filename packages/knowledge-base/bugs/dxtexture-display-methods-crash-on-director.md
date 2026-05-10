---
type: bug
status: confirmed
severity: crash
tested: "2026-04-11"
api_coverage:
  - name: "Display.getImageMosaic on Director"
    match: "\\.getImageMosaic\\s*\\("
    related_files: ["display-output-capture.md"]
    required: true
---

# Display Capture Methods Can Crash on Director

## Symptom

Calling `display.getImageMosaic(iTarget, etf)` or `display.target(iTarget)` from
Director can native-crash because Director has no VFC GPU render targets for
the output head. The failure appears as HTTP 500 with no useful Python
traceback.

## Context

The confirmed failure is Director-specific. Render-machine behavior with real
VFC outputs may differ, but still needs site-specific confirmation before
depending on it.

## Unsafe on Director

```python
display = rect.referenceDisplay
mosaic = display.getImageMosaic(int(rect.displayTarget), 0)
target = display.target(int(rect.displayTarget))
```

## Workarounds

For a Director-side visual preview, use the local visualiser camera:

```python
import d3
camera = d3.Camera.localVisualiserCamera()
camera.saveCurrentView("snapshot_name")
```

For actual output pixels, call the render machine's Python API directly, using
the render machine hostname/IP. Do not send this call to Director.

Mac browsers may block a plugin page served by Director from calling the render
machine directly due to CORS.
