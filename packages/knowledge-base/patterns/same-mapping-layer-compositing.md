---
type: pattern
status: observed
tested: "2026-08-25"
api_coverage:
  - name: "Track.addNewLayer same-mapping stack"
    match: "addNewLayer\\s*\\(\\s*d3\\.VariableVideoModule"
    related_files: ["same-mapping-layer-compositing.md", "video-layer-placement.md"]
    required: false
  - name: "TrackPlayer.activeLayers order"
    match: "\\.activeLayers"
    related_files: ["same-mapping-layer-compositing.md", "multitransport-live-surface-stack.md"]
    required: false
  - name: "FieldSequence resource assignment"
    match: "\\.sequence\\.setResource\\s*\\("
    related_files: ["same-mapping-layer-compositing.md", "layer-mapping-assignment.md"]
    required: false
  - name: "DirectProjection same mapping"
    match: "DirectProjection"
    related_files: ["same-mapping-layer-compositing.md", "stage-screen-and-projection-setup.md"]
    required: false
---

# Same-Mapping Layer Compositing

## Purpose

Confirm the layer-order model when multiple video layers target the same mapping
at the same cue and duration.

Evidence:

- Focused same-mapping compositing probe
- Designer `r34.0.3.258249` in a disposable live project

## Confirmed Fixture

The probe created or reused a mapping named `map3`, then created two
`VariableVideoModule` layers at beat `30` for `8` beats:

1. Bottom test layer
2. Top overlay test layer

Both layers were assigned to the same `objects/direct/map3.apx` mapping through
the confirmed `FieldSequence.setResource(layer.tStart, resource)` pattern for
`video` and `mapping`.

After a follow-up execution/read at beat `31`:

- `track.layers` returned the top overlay before the bottom background:
  top index `0`, bottom index `1`.
- `TrackPlayer.activeLayers` returned the bottom background before the top
  overlay: bottom index `0`, top index `1`.
- FieldSequence readback matched the expected mapping and video resources for
  both layers.
- A visualiser screenshot showed the top overlay visible on the shared probe
  surface.

## Alpha Confirmation

A follow-up run seeded two test PNG files into an isolated folder under
`objects/VideoFile/` before running Designer Python, allowing Designer to
auto-create valid `VideoClip` resources before layer setup:

- opaque blue/yellow checker background
- transparent/partially transparent red overlay with an opaque white X

The setup phase selected both clips as `existing-alpha-seed`, each with
`fileNFrames = 1`, `fileFps = 1`, `enabledVersion = "0"`, and
`file.hasAlpha == "True"`.

The verification screenshot showed the red overlay above the lower layer, while
transparent and partially transparent areas revealed the blue/yellow
background underneath. This confirms same-mapping alpha compositing for the
tested layer stack.

## Planning Rule

For same-mapping video stacks, creating planned layers in bottom-to-top order
is consistent with the observed Designer stack:

```python
bottom = track.addNewLayer(d3.VariableVideoModule, start, length, bottom_name)
top = track.addNewLayer(d3.VariableVideoModule, start, length, top_name)
```

Use a follow-up read after setup before trusting `player.activeLayers`; active
layer ordering can be stale inside the same mutating execution that created the
layers.

## Caveats

Dynamically writing PNG files from inside the same Designer Python execution
still did not produce usable `VideoClip` resources immediately in an earlier
exploratory run. For alpha proof, seed the PNG files in `objects/VideoFile`
before the probe setup execution, then let Designer auto-create the
`VideoClip`s.

The `opacity` field was not present on these `VariableVideoModule` layers in
this fixture; readback returned `null`.

## Cleanup Notes

The probe removes its temporary layers, marker file, generated media fallback
files, generated fallback clips, alpha-seed clip resources when used, created
the temporary mapping and screen resources, and the screen companion
direct-projection resources Designer may auto-create for the temporary surface.
For seeded PNGs, unlock `VideoFile` resources before deleting raw files; Designer
can keep image handles open briefly after the layer and clip resources are
removed.
