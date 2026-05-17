---
type: pattern
status: observed
tested: "2026-04-11"
api_coverage:
  - name: "Display.getImageMosaic"
    match: "\\.getImageMosaic\\s*\\("
    related_files: ["display-output-capture.md"]
    required: true
---

# Display Output Capture

## Purpose

Capture an image of a feed/display output for diagnostics or background
preview UI.

This is not the same as `patterns/media-thumbnail-extraction.md`, which creates
thumbnails for `VideoFile` resources. Output capture needs a live display render
target.

## Safe Decision Tree

1. On Director, do not call `Display.getImageMosaic()` or `Display.target()`.
   They can native-crash when no VFC render target exists. Use a visualiser
   screenshot instead:

   ```python
   import d3
   camera = d3.Camera.localVisualiserCamera()
   camera.saveCurrentView("output_preview")
   ```

2. For actual output pixels, call the Python API on the render machine that owns
   the head, not on Director. Use the render machine hostname/IP in the browser
   or a local diagnostic script. Mac browsers may block this cross-origin call
   when the plugin was served by Director.

3. In dev/emulation with no VFC hardware, `getImageMosaic(0, 0)` raised
   `RuntimeError("!displayTargets.empty()")`. That error was catchable. Do not
   treat it as evidence that the hardware path is invalid.

## Render-Machine Probe Shape

Only run this on the render machine that owns the output head:

```python
import d3
import os

machines = resourceManager.allResources(d3.Machine)
for mi in range(len(machines)):
    machine = machines[mi]
    if not machine.feed:
        continue

    rects = machine.feed.feedRects
    for ri in range(len(rects)):
        rect = rects[ri]
        display = rect.referenceDisplay
        if display is None:
            continue

        mosaic = display.getImageMosaic(int(rect.displayTarget), 0)
        if mosaic is None:
            continue

        screenshots = os.path.join(os.getcwd(), "screenshots")
        if not os.path.isdir(screenshots):
            continue

        path = os.path.join(screenshots, "probe_mosaic_{0}_{1}.png".format(mi, ri))
        mosaic.saveToFile(path)
```

## Do Not Create Project Folders Mid-Session

`os.makedirs()` under `os.getcwd()` can crash Designer at engine level. For
capture probes, only write to directories Designer already created, such as the
project `screenshots/` folder.

See [os-makedirs-project-folder-crash.md](../bugs/os-makedirs-project-folder-crash.md).

## Ruled Out For Output Capture

`d3.ThumbnailSystem()` was present, with `supportsThumbnails` true, but
`isEnabled` false and output-capture `getThumbnail()` attempts returned
`None`. Keep using `ThumbnailSystem` only for the separate video-file thumbnail
pattern that has its own live proof.
