---
type: pattern
status: observed
tested: "2026-05-19"
api_coverage:
  - name: "MultiTransportManager.transportManagers"
    match: "\\.transportManagers"
    related_files: ["multitransport-live-surface-stack.md"]
    required: false
  - name: "MultiTransportManager nested LiveUpdate transport paths"
    match: "object\\.transportManagers\\["
    related_files: ["multitransport-live-surface-stack.md", "liveupdate-subscribe.md"]
    required: false
  - name: "TrackPlayer.activeLayers"
    match: "\\.activeLayers"
    related_files: ["multitransport-live-surface-stack.md", "liveupdate-subscribe.md"]
    required: false
  - name: "FeedProjection.feed_scene"
    match: "\\.feed_scene"
    related_files: ["multitransport-live-surface-stack.md", "feed-scene-config.md"]
    required: false
  - name: "FeedScene.feedRects"
    match: "\\.feedRects"
    related_files: ["multitransport-live-surface-stack.md", "feed-scene-config.md"]
    required: false
  - name: "FieldSequence.getSequencedValue"
    match: "getSequencedValue\\("
    related_files: ["multitransport-live-surface-stack.md", "layer-field-sequences.md"]
    required: false
  - name: "LiveUpdate getByUID object path"
    match: "getByUID\\("
    related_files: ["multitransport-live-surface-stack.md", "liveupdate-subscribe.md"]
    required: false
  - name: "LiveUpdate indexed collection mutation"
    match: "propertyPathError|object\\.[A-Za-z]+\\[[0-9]+\\]"
    related_files: ["multitransport-live-surface-stack.md", "liveupdate-subscribe.md"]
    required: false
---

# Multi-Transport Live Surface Stack

## Purpose

Build a live view of layers contributing to a selected LED screen or projection
surface across every transport inside a `MultiTransportManager`.

This pattern was observed in a live test session containing one
`MultiTransportManager` named `multitransport`, three child
`TransportManager` resources, three tracks, and one active video layer per
track. All layers targeted the same `Screen2` surface through the same
`DirectProjection`.

Evidence:

- `reference-tools/probe_multitransport_surface_stack.py`
- `reference-tools/probe_liveupdate_subscriptions.mjs`
- `reference-tools/probe_multitransport_zorder_setup.py`
- `reference-tools/probe_multitransport_zorder_cleanup.py`
- `reference-tools/probe_liveupdate_exec_mutation.mjs`
- `reference-tools/probe_multitransport_feed_projection.py`
- `reference-tools/probe_screen_inspector_dynamic_state.py`
- `reference-tools/probe_feed_mapping_live_paths.py`

## Python Bootstrap Shape

Use Python for a read-only session graph bootstrap, not for playhead polling:

```python
import d3

multi_transport_managers = resourceManager.allResources(d3.MultiTransportManager)
for i in range(len(multi_transport_managers)):
    mtm = multi_transport_managers[i]
    child_managers = mtm.transportManagers
    for j in range(len(child_managers)):
        tm = child_managers[j]
        track = tm.player.track
        active_layers = tm.player.activeLayers
```

Observed fields:

- `MultiTransportManager.transportManagers` returned the three child
  `TransportManager` resources.
- Each child `TransportManager.player.tRender` held that transport's current
  render beat.
- Each child `TransportManager.player.activeLayers` returned the layer active at
  that transport's current moment.
- `TransportManager.engaged` was `False` in the fixture while
  `player.activeLayers` still reported active layers. Do not treat `engaged`
  alone as proof that a transport contributes no pixels without further
  compositor-specific evidence.

## LiveUpdate Paths

Path-derived object names with spaces still fail:

```text
track:track 1
transportManager:transport 2
screen2:surface 1
```

Each returned `UnexpectedToken`. Use UID object paths instead. Format the UID
as hexadecimal, including the `0x` prefix:

```text
getByUID(0x1324592081ce21b0)
getByUID(0x644ea7fb21d9d232)
getByUID(0x108901207f621daa)
```

Hex UID paths successfully subscribed to tracks, transport managers whose names
contain spaces (`transport 2`, `transport 3`), and surfaces whose names contain
spaces (`surface 1`). Decimal UID paths are not safe: smaller decimal track UIDs
worked in one probe, but larger transport and multi-transport decimal UIDs
failed with `InvalidCharacter`.

Do not subscribe to live `.uid` properties on layer paths for large identifiers.
During `screen-inspector` browser QA, paths such as
`object.player.activeLayers[0].uid` failed with
`Unable to subscribe to property: long too big to convert`. Capture UID strings
and `getByUID(0x...)` object paths in the Python bootstrap, then use live
`name`, `description`, mapping, and module fields for realtime updates.

When managing raw LiveUpdate WebSocket subscriptions directly, merge
`subscriptions` acknowledgement arrays into the id-to-path lookup. Do not replace
the whole lookup for each acknowledgement when multiple subscribe messages are
sent on one socket; later acknowledgements can otherwise orphan earlier
subscription ids and make subsequent `valuesChanged` messages look inert.

`state.stage` is also addressable through a hex UID path. In the observed
session, `getByUID(0x108b59207f71a5d6)` accepted indexed collection paths:

```text
object.surfaces[0].description
object.ledScreens[0].description
object.displays[0].description
```

Subscribing to spare indices such as `object.surfaces[1].description` returned a
`propertyPathError` until a collection item exists. Treat a change from that
error to a display name as an event-driven topology refresh signal.

When the `MultiTransportManager` resource path itself has no spaces, direct
LiveUpdate paths also work:

```typescript
liveUpdate.subscribe('multitransportmanager:multitransport', {
  t0: 'object.transportManagers[0].player.tRender',
  t1: 'object.transportManagers[1].player.tRender',
  t2: 'object.transportManagers[2].player.tRender',
})
```

Nested active-layer paths also worked from the multi-transport object:

```typescript
liveUpdate.subscribe('multitransportmanager:multitransport', {
  layer0: 'object.transportManagers[0].player.activeLayers[0].name',
  brightness0: 'object.transportManagers[0].player.activeLayers[0].module.brightness',
  mapping0: 'object.transportManagers[0].player.activeLayers[0].module.mapping.description',
})
```

Nested child transport brightness under the `MultiTransportManager` also
worked and proved more reliable for plugin UI updates than subscribing only to
each child `TransportManager` object. The same applies to child transport render
time when tracking same-layer keyframed mapping changes from a plugin window:

```text
object.transportManagers[0].player.tRender
object.transportManagers[1].player.tRender
object.transportManagers[2].player.tRender
object.transportManagers[0].brightness
object.transportManagers[1].brightness
object.transportManagers[2].brightness
```

Use nested MTM paths as the preferred source for child transport `player.tRender`
and `brightness` when available, with direct child paths as fallbacks for
non-MTM sessions. In the observed fixture, changing the default child transport
brightness 1 -> 0 removed its row from `screen-inspector`, and changing 0 -> 1
re-added it without a Python polling loop. A reversible jump probe confirmed
`object.transportManagers[1].player.tRender` emitted 34 -> 31 when transport 2
was moved.

## Surface Membership

For the observed DirectProjection case, use Python bootstrap to join a layer to
its target displays:

```python
field = layer.findSequence("mapping")
value = field.getSequencedValue(tm.player.tRender)
projection = value.value
screens = projection.screens
```

In the fixture, each active layer's mapping was `surface 1 (direct)`, whose
`Projection.screens` list contained `objects/screen2/surface 1.apx`.

For live display of current module values, prefer LiveUpdate paths such as
`object...activeLayers[N].module.brightness`. In the fixture, one static Python
field read disagreed with the LiveUpdate module value, while LiveUpdate matched
the active module state exposed to the frontend.

## FeedProjection Membership

`FeedProjection` resources can be resolved to v1 target displays through
`feed_scene.feedRects`. In the observed session, the FeedProjection
`objects/feedprojection/led1 feed.apx` initially resolved to
`objects/ledscreen/led 1.apx`, then later resolved to both
`objects/ledscreen/led 1.apx` and `objects/screen2/surface 1.apx` after a
second feed rect was added.

The Python property name on `FeedProjection` is `feed_scene`:

```python
feed_scene = projection.feed_scene
rects = feed_scene.feedRects
for i in range(len(rects)):
    rect = rects[i]
    target = None
    try:
        target = rect.referenceDisplay
    except:
        pass
    if target is None:
        try:
            target = rect.screen
        except:
            pass
    if target is None:
        try:
            target = rect.resolveDisplay()
        except:
            pass
```

The observed feed rect rows had usable `referenceDisplay`, and probes also
checked `screen` and `resolveDisplay()` defensively. Keep the target list as a
set of display paths, UIDs, and descriptions because a single feed mapping can
fan out to multiple displays.

Observed layer cases:

- `aces2065-1_colorchecker2014` on `transport 2` was active at the transport
  render time and mapped through `FeedProjection` `led1 feed`.
- `1100_lilly_s001` on `transport 2` was not active at the transport render
  time, but its mapping at `tStart` also resolved through `led1 feed`.

This confirms FeedProjection target membership, but active contribution still
must be evaluated at each child transport's `player.tRender`.

`FeedScene` resources are addressable through `getByUID(0x...)` LiveUpdate
paths. Indexed feed-rect paths worked in the live session:

```text
object.feedRects[0].description
object.feedRects[0].referenceDisplay.description
object.feedRects[0].active
object.feedRects[0].head
```

Spare feed-rect indices such as `object.feedRects[2].description` returned a
`propertyPathError` (`Index outside bounds 2 / 2`) when only two rects existed.
Treat any later change on `object.feedRects[...]` paths, including an error
changing to a display name or a display name changing to an error, as an
event-driven FeedProjection topology refresh signal. This lets an open plugin
refresh its projection target index when a mapping starts or stops targeting an
additional screen without polling Python.

## Keyframed Mapping Membership

LiveUpdate active-layer paths are enough to know the active leaf layers and
transport render time, but a layer's keyframed `mapping` membership should be
sampled from the `FieldSequence` during Python bootstrap. Use
`layer.findSequence("mapping").getSequencedValue(t)` at the layer start, current
transport render beat, `layer.keyTimes()`, and mapping sequence key times. Do
not read `layer.mapping` directly.

Do not treat LiveUpdate `module.mapping.description` as authoritative for
keyframed mapping membership. At transport 2 beat 34, Python
`getSequencedValue(34)` returned `surface 1 (direct)` for
`aces2065-1_colorchecker2014`, while LiveUpdate paths such as
`object.player.activeLayers[1].module.mapping.description`,
`object.layers[1].module.mapping.description`, and
`getByUID(layer).object.module.mapping.description` returned stale/default
mapping values.

Observed keyframed case:

```text
transport 2 / aces2065-1_colorchecker2014
beat 15-29: led1 feed -> objects/ledscreen/led 1.apx
beat 30+: surface 1 (direct) -> objects/screen2/surface 1.apx
```

After adding sampled mapping spans to `screen-inspector`, a reversible transport
jump from beat 29 to beat 31 moved that layer from `led 1` to `surface 1`, and
jumping back to beat 29 restored it to `led 1`. The UI update was driven by the
live `player.tRender` subscription selecting a different bootstrap sample, not
by polling Python as the playhead moved.

When an active-layer slot changes to a different layer, do not let the old
bootstrap active-layer UID win over the new live layer name. At transport 2 beat
54, active slot 1 changed from `aces2065-1_colorchecker2014` to
`1100_lilly_s001`; both direct and nested LiveUpdate active-layer name paths
reported `1100_lilly_s001`. The plugin had to blank the bootstrap UID when the
live name differed from the bootstrap name, then match the track tree by the
live name. Otherwise the old aces layer's sampled mapping could be applied to
the new active slot and leave `led 1` empty.

Treat `activeLayers[N]` as a live slot, not a persistent layer identity. In the
observed fixture, the live name was enough to re-correlate the slot with the
track tree after the UID was blanked. Duplicate active layer names across the
same track were not tested; if that becomes a real fixture, add another stable
live discriminator before relying on name-only matching.

## Z-Order and Groups

A temporary fixture on `track 1` created three overlapping layers, then grouped
the top two:

```text
track.layers[0] = Probe Surface Stack Group
  group.layers[0] = Probe Surface Stack Top
  group.layers[1] = Probe Surface Stack Middle
track.layers[1] = Probe Surface Stack Bottom
track.layers[2] = 1090_lillyimagery_s001
```

After Designer refreshed, `TrackPlayer.activeLayers` and LiveUpdate active-layer
paths returned the active leaf layers in this order:

```text
activeLayers[0] = 1090_lillyimagery_s001
activeLayers[1] = Probe Surface Stack Bottom
activeLayers[2] = Probe Surface Stack Middle
activeLayers[3] = Probe Surface Stack Top
```

Observed implications:

- `activeLayers` is a flattened active leaf list; it does not preserve visible
  group rows.
- In this fixture, `activeLayers` appeared to be low-to-high compositing order
  within a transport.
- `track.layers` preserves visible top-level rows and group nesting.
- `track.findLayerIndex(child)` returned `-1` for child layers inside a group;
  use layer UIDs/names to correlate active leaf rows back to group children.
- Immediately inside the same Python execution that created/grouped layers,
  `player.activeLayers` still returned only the pre-existing layer. A subsequent
  Python read and LiveUpdate subscription both returned the full four-layer
  active list. Avoid relying on same-exec active-layer reads after timeline
  mutations.

## LiveUpdate Collection Mutation Signal

The mutation probe kept a LiveUpdate subscription open on a track UID while a
Python cleanup removed the temporary group and layer. Indexed paths emitted
updates without polling:

```text
object.layers[0].name: Probe Surface Stack Group -> 1090_lillyimagery_s001
object.layers[1].name: Probe Surface Stack Bottom -> Index outside bounds 1 / 1
object.layers[0].layers[0].name: Probe Surface Stack Top -> no attribute 'layers'
```

Treat `propertyPathError` values on indexed collection subscriptions as a valid
topology-change signal. The plugin can use this to trigger an event-driven
topology refresh; that is not polling.

## Remaining Probe Needs

This pattern does not yet prove:

- z-order across multiple child transport managers in the compositor;
- whether a Designer/compositor API exposes the final cross-transport draw order
  beyond `MultiTransportManager.transportManagers` list order;
- how to disambiguate active-layer slot changes when two candidate layers on
  the same track have the same live name.
