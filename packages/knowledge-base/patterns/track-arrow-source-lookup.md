---
type: pattern
status: confirmed
tested: "2026-07-06"
designer_version: "r33.2.1"
api_coverage:
  - name: "SuperTrack.arrows"
    match: "\\.arrows"
    related_files: ["track-arrow-source-lookup.md"]
    required: false
  - name: "Arrow.srcUid"
    match: "\\.srcUid"
    related_files: ["track-arrow-source-lookup.md"]
    required: false
  - name: "Arrow.destUid"
    match: "\\.destUid"
    related_files: ["track-arrow-source-lookup.md"]
    required: false
---

# Track Arrow Source Lookup

## Purpose

To find the layer that is arrowed into another layer, use the track's
`arrows` collection. The simplest confirmed read path is UID matching:

- `arrow.srcUid` - UID of the source layer, visually arrowed in
- `arrow.destUid` - UID of the destination layer, visually receiving the arrow

Resolve those UIDs against `track.layers` using `layer.name` and `layer.uid`.
This answers the common "what layer is arrowed into this destination layer?"
question without needing to parse module-specific state.

## Confirmed Result

Probe:

```bash
npm run cli -- exec --file packages/knowledge-base/reference-tools/probe_track_arrow_uid_lookup.py
```

Observed on restored `objects/track/track 1.apx`:

- target destination layer `Notch`
  - UID `11773370305937967695`
  - hex UID `0xa36369ea4e908a4f`
- matched `track.arrows[0].destUid == 11773370305937967695`
- source layer resolved from `track.arrows[0].srcUid`
  - name `Video`
  - UID `3367478366621359178`
  - hex UID `0x2ebbafbb97475c4a`

The same UID-only function was also registered via
`/api/session/python/registermodule` and returned the same source/destination
pair.

## Minimal Registered-Module Pattern

This is Python 2.7-compatible and returns JSON-safe data.

```python
__all__ = ["get_arrow_source_for_dest_layer"]

import json


def safe(fn, default=None):
    try:
        return fn()
    except:
        return default


def text(value):
    try:
        if value is None:
            return ""
        return str(value)
    except:
        return ""


def uid_hex(uid_text):
    try:
        return "0x%x" % int(str(uid_text).rstrip("Ll"), 0)
    except:
        return None


def layer_info(layer, index):
    uid = text(safe(lambda: layer.uid))
    hx = uid_hex(uid)
    return {
        "index": index,
        "name": text(safe(lambda: layer.name)),
        "uid": uid,
        "uidHex": hx,
        "liveObjectPath": ("getByUID(%s)" % hx) if hx else None,
    }


def get_arrow_source_for_dest_layer(dest_layer_name):
    track = safe(lambda: guisystem.track)
    if track is None:
        return json.dumps({"ok": False, "error": "guisystem.track is None"})

    layers = safe(lambda: track.layers, [])
    by_uid = {}
    dest_uid = None

    for index in range(len(layers)):
        layer = safe(lambda index=index: layers[index])
        if layer is None:
            continue
        row = layer_info(layer, index)
        by_uid[row["uid"]] = row
        if row["name"].lower() == str(dest_layer_name).lower():
            dest_uid = row["uid"]

    if not dest_uid:
        return json.dumps({"ok": False, "error": "destination layer not found"})

    arrows = safe(lambda: track.arrows, [])
    for index in range(len(arrows)):
        arrow = safe(lambda index=index: arrows[index])
        src_uid = text(safe(lambda arrow=arrow: arrow.srcUid))
        arrow_dest_uid = text(safe(lambda arrow=arrow: arrow.destUid))
        if arrow_dest_uid == dest_uid:
            return json.dumps({
                "ok": True,
                "arrowIndex": index,
                "destLayer": by_uid.get(dest_uid),
                "sourceLayer": by_uid.get(src_uid),
                "srcUid": src_uid,
                "destUid": arrow_dest_uid,
            })

    return json.dumps({"ok": False, "error": "no arrow found for destination"})
```

For the restored Track 1 fixture:

```python
return get_arrow_source_for_dest_layer("Notch")
```

returns the `Video` layer.

## Follow-Up Incident Testing

An earlier broader read probe was followed by the Notch layer disappearing from
the live track. Follow-up ladder probes did not reproduce the disappearance.
Both anonymous `/execute` and registered-module `/execute` survived these read
surfaces while the Notch layer and arrow remained present:

- `track.arrows` length
- `arrow.srcUid` / `arrow.destUid`
- `arrow.isValid`, `arrow.conflicted`, and `arrow.t`
- `arrow.src` / `arrow.dest`
- `layer.module` on the Notch layer
- `module.currentLayerName`
- `module.activeFields` length
- `layer.nSequences()`
- `layer.sequence(i)` names/type metadata

Do not treat the one-off disappearance as proof that Notch parsing is unsafe.
The UID pattern remains recommended because it is compact and directly answers
the arrow lookup question.

See `bugs/notch-layer-disappeared-after-read-probe.md`.

## Related

- `docs/reference.md` - `track.makeArrow(src_layer, dst_layer)`
- `packages/knowledge-base/reference-tools/probe_track_arrow_uid_lookup.py`
- `packages/knowledge-base/reference-tools/probe_notch_incident_ladder.py`
- `packages/knowledge-base/reference-tools/probe_notch_incident_ladder_registered.mjs`
- `packages/knowledge-base/bugs/notch-layer-disappeared-after-read-probe.md`
