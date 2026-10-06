---
type: bug
status: observed-unreproduced
severity: critical
tested: "2026-07-06"
---

# Notch Layer Disappeared After Read Probe, Not Reproduced

## Symptom

During a live Designer r33.2.1 investigation, Track 1 initially contained:

- `Notch` layer, `NotchModule`, UID `15354106994843235046`
- `Video` layer, `VariableVideoModule`, UID `16241224949251411904`
- one arrow from `Video` into `Notch`

A broad read probe reported the expected arrow: `track.arrows[0].src` was
`Video` and `track.arrows[0].dest` was `Notch`.

Later in the same session, without any explicit mutating API call in the probe
code, the live track reported only the `Video` layer and zero arrows. The user
confirmed they did not remove the Notch layer manually. The user then restored
the fixture.

## Current Interpretation

This is an observed incident, not an isolated crasher and not proof that Notch
module parsing is unsafe.

The exact cause is unknown. Possibilities include, but are not limited to:

- a side effect from one of the broad read surfaces
- registered-module context behavior
- a Designer UI/resource refresh behavior triggered by reading the layer/module
- an unrelated live-state transition during probing

## Follow-Up Ladder Results

After the user restored the fixture, two controlled ladder probes were run:

- anonymous `/api/session/python/execute` via
  `probe_notch_incident_ladder.py`
- registered-module `/api/session/python/registermodule` plus module-scoped
  `/execute` via `probe_notch_incident_ladder_registered.mjs`

Both ladders tested one surface per step, with UID-only before/after checks.
Neither reproduced the disappearance. The Notch layer and arrow remained present
after every step.

Surfaces tested successfully:

- `track.arrows` length only
- `arrow.srcUid` / `arrow.destUid`
- `arrow.isValid`, `arrow.conflicted`, and `arrow.t`
- `arrow.src` / `arrow.dest`
- `layer.module` on a `NotchModule` layer
- `layer.nSequences()` / `layer.sequence(i)` on a `NotchModule` layer
- registered-module reads of Notch properties such as `activeFields` and
  `currentLayerName`

## Safer Replacement For Original Task

For arrow lookup, use `Arrow.srcUid` and `Arrow.destUid` only, then resolve
those UIDs against `track.layers` by reading layer `name` and `uid`. This was
verified after the user restored the test fixture, including through a
registered module.

See `patterns/track-arrow-source-lookup.md`.

## Guidance

- Prefer Designer UI undo immediately if this happens.
- Do not document a broad "Notch parsing is unsafe" rule from this one incident.
- If the disappearance recurs, capture the exact immediately preceding call and
  rerun the ladder from that point.
- If recovery by API is approved, recreate only from captured evidence and make
  clear that hidden Notch block/config state may not be recoverable.

## Related

- `packages/knowledge-base/reference-tools/probe_track_arrow_uid_lookup.py`
- `packages/knowledge-base/reference-tools/probe_notch_incident_ladder.py`
- `packages/knowledge-base/reference-tools/probe_notch_incident_ladder_registered.mjs`
- `packages/knowledge-base/patterns/track-arrow-source-lookup.md`
- `packages/knowledge-base/bugs/registermodule-import-d3.md`
