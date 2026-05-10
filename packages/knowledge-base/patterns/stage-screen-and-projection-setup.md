---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "state.stage"
    match: "state\\.stage"
    related_files: ["stage-screen-and-projection-setup.md"]
    required: false
  - name: "Projection.screens"
    match: "\\.screens\\s*="
    related_files: ["stage-screen-and-projection-setup.md"]
    required: false
  - name: "FeedRect"
    match: "\\bFeedRect\\b"
    related_files: ["stage-screen-and-projection-setup.md"]
    required: false
---

# Stage, Screens, Projections, and Feeds

## Stage Objects

`state.stage` exposes LED screens, projection surfaces, and projectors.

```python
stage = state.stage

led = resourceManager.loadOrCreate("objects/ledscreen/main.apx", LedScreen)
led.resolution = Vec2(3840, 2160)
led.scale = Vec(14, 8, 1)

existing = list(stage.ledScreens)
if led not in existing:
    existing.append(led)
    stage.ledScreens = existing
```

Notes:

- LED screen resolution is the pixel grid of the wall.
- `scale` is physical size in meters; the default mesh is a 1m x 1m plane.
- `offset` and `rotation` are 3D transform fields in meters/degrees.
- Designer lowercases screen resource names.
- New screens usually get a default direct projection automatically.
- When adding or removing displays from `stage.ledScreens`, `stage.surfaces`,
  or `stage.projectors`, use native-list reassignment. This avoids relying on
  proxy collection mutation semantics.

## Surface Meshes

For custom surface shapes:

```python
mesh = resourceManager.loadOrCreate("objects/meshfromobj/name.apx", MeshFromObj)
screen.mesh = mesh
```

Useful mesh flags include `flip_U`, `flip_V`, `swap_U_V`, and
`useFileNormals`.

## DirectProjection

Direct projections link one content canvas to one or more displays:

```python
mapping = resourceManager.loadOrCreate(
    "objects/directprojection/main direct.apx",
    DirectProjection,
)
mapping.resolution = Vec2(3840, 2160)
mapping.screens = [screen]
mapping.save()
```

For multi-screen direct projections, set `Projection.screens` to the complete
list of displays. Appending means read the current list, add one, then assign
the whole list back.

For a direct projection matched to a display, copy the display resolution onto
the projection resolution after assigning `screens`.

## Machine and d3Net Roles

Machine resources live under `objects/machine/<hostname>.apx`. A machine's
network role is stored on the `D3NetManager`, not on the machine alone:

- `d3net.director` for the Director machine.
- `d3net.director_type = True` for a dedicated Director.
- `d3net.actors` for render actors.
- `d3net.understudies` for understudy machines.

Assign actor/understudy lists by copying to a native list, appending the
machine if absent, then assigning the list back. A machine used for output
routing should have a `FeedScene` assigned to `machine.feed`.

## FeedProjection

Feed projections are content canvases spanning multiple feed rectangles:

```python
projection = resourceManager.loadOrCreate(
    "objects/feedprojection/wall canvas.apx",
    FeedProjection,
)
projection.resolution = Vec2(7680, 2160)
```

A content-canvas `FeedProjection` should have its own `FeedScene`; do not reuse
a machine/output-routing FeedScene.

## FeedRect Setup

`Rect()` has a default constructor only. Set the coordinates individually.

```python
rect = resourceManager.loadOrCreate("objects/feedrect/wall h1 main.apx", FeedRect)
rect.screen = screen
rect.head = 1

rect.screenRect = Rect()
rect.screenRect.x0 = 0
rect.screenRect.y0 = 0
rect.screenRect.x1 = 3840
rect.screenRect.y1 = 2160

rect.outputRect = Rect()
rect.outputRect.x0 = 0
rect.outputRect.y0 = 0
rect.outputRect.x1 = 3840
rect.outputRect.y1 = 2160
```

Notes:

- Head 0 is the GUI head on pro-range machines; feed outputs start at head 1.
- Pass real head resolution instead of relying on a 4K default.
- `FeedRect.active` is read-only.
- Machine FeedScenes are for output routing and may include processor packing
  gaps; content FeedScenes should be pixel-perfect and logically ordered.

