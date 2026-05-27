---
type: pattern
status: confirmed
tested: "2026-05-26"
designer_version: "r33.0.2.246160"
api_coverage:
  - name: "MeshFromObj OBJ resource path"
    match: "objects/meshfromobj/.+\\.obj"
    related_files: ["project-builder-stage-import.md"]
    required: false
  - name: "DirectProjection short resource path"
    match: "objects/direct/"
    related_files: ["project-builder-stage-import.md"]
    required: false
  - name: "Prop render tint"
    match: "renderSettings\\.tint"
    related_files: ["project-builder-stage-import.md"]
    required: false
---

# Project Builder Stage Import

`MeshFromObj` can load a real `.obj` file after the file is moved into the
project under `objects/MeshFromObj/<subfolder>/<name>.obj`.

Confirmed resource paths:

```python
screen_mesh = resourceManager.load(
    "objects/meshfromobj/screen/wall.obj",
    d3.MeshFromObj,
)
prop_mesh = resourceManager.load(
    "objects/meshfromobj/prop/wall.obj",
    d3.MeshFromObj,
)
led = resourceManager.loadOrCreate("objects/ledscreen/main.apx", d3.LedScreen)
surface = resourceManager.loadOrCreate("objects/screen/main.apx", d3.Screen2)
direct = resourceManager.loadOrCreate("objects/direct/main direct.apx", d3.DirectProjection)
prop = resourceManager.loadOrCreate("objects/prop/wall.apx", d3.Prop)
```

For screens, assign the mesh and resolution, then reassign the complete native
stage list:

```python
screen.resolution = d3.Vec2(3840.0, 2160.0)
screen.mesh = screen_mesh
screens = list(stage.ledScreens)
screens.append(screen)
stage.ledScreens = screens
```

For projection surfaces use `stage.surfaces` with `d3.Screen2` and the
`objects/screen/` resource folder.

Direct projections are valid under `objects/direct/`:

```python
direct.screens = [screen]
direct.resolution = d3.Vec2(3840.0, 2160.0)
```

Prop flat colour can be set through render settings:

```python
prop.renderSettings.tint = d3.Colour(0.1, 0.1, 0.1, 1.0)
```

## Save Scope

Avoid `resourceManager.saveAll()` in this flow. During the confirmation probe,
`saveAll()` touched unrelated track/metafield/sticky-manager resources and
emitted a sticky-manager write error. The focused rerun passed cleanly when it
saved only the created/edited resources and `state.stage`.

Use direct resource saves:

```python
screen.save()
direct.save()
prop.save()
venue.save()
state.stage.save()
```

Probe file:
`packages/knowledge-base/reference-tools/probe_project_builder_stage_import.py`.
