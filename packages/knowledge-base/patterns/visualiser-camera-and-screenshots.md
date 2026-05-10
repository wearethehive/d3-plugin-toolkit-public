---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "Camera.localVisualiserCamera"
    match: "Camera\\.localVisualiserCamera\\s*\\("
    related_files: ["visualiser-camera-and-screenshots.md"]
    required: false
---

# Visualiser Camera and Screenshots

## Camera Access

```python
camera = Camera.localVisualiserCamera()

camera.offset = Vec(0, 2, 10)       # meters
camera.rotation = Vec(-10, 0, 0)    # degrees
camera.fieldOfViewH = 60            # horizontal FOV
```

The visualiser camera faces +Z. Screens at `z=0` are viewed head-on from
negative Z or positive Z depending on the desired side.

## Preset Coordinates

Useful starting positions:

| Preset | Position | Rotation |
|---|---|---|
| front | `Vec(0, 0, 10)` | `Vec(0, 0, 0)` |
| back | `Vec(0, 0, -10)` | `Vec(0, 180, 0)` |
| top | `Vec(0, 10, 0)` | `Vec(-90, 0, 0)` |
| left | `Vec(-10, 0, 0)` | `Vec(0, 90, 0)` |
| right | `Vec(10, 0, 0)` | `Vec(0, -90, 0)` |

## Screenshots

```python
camera = Camera.localVisualiserCamera()
camera.saveCurrentView("probe_view")
```

Designer saves into the project's `screenshots/` directory and appends a frame
suffix such as `_00000` to the filename.

Screenshot format is controlled by:

```python
PrivateState.privateState().screenshot_format = 2  # PNG
```

Known enum values: `0=JPEG`, `1=BMP`, `2=PNG`, `3=TIF`, `4=DPX`, `5=EXR`.

## Test Pattern Assets

Visualiser and feed setup checks are easier to read with generated test media:
a dark background, regular minor/major grid, border, center label, resolution
label, and corner coordinates. Generate those images outside Designer, then
ingest them as normal video/image content through `video-content-management.md`.

Keep the asset generator outside Designer Python. Designer should only load or
assign the resulting media resource.

