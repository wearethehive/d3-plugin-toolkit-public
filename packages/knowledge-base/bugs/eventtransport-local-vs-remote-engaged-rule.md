---
type: bug
status: confirmed
severity: silent-failure
tested: "2026-04-08"
---

# EventTransport: local_transports vs remote_transports and the engaged Rule

## Symptom

An `EventTransportOSC` added to `tm.remote_transports` does NOT route
packets, even though:

- The OSC device clearly receives them (visible in the Recorders panel)
- The transport is properly bound to the device with the correct address
- `tm.engaged == False` at the time of testing

The transport's `fieldActivity` (or equivalent activity surface) stays
empty. No exception, no log line — silent failure.

## Root cause

`TransportManager.local_transports` and `TransportManager.remote_transports`
are NOT functionally equivalent. They differ in how they respect the
manager's `engaged` state:

- **`local_transports`** route incoming events **regardless** of
  `tm.engaged` state. Use this for plugins that need to react to OSC
  during pre-show, rehearsal, programming, etc.
- **`remote_transports`** only route incoming events when
  `tm.engaged == True`. Use this for production cue dispatch where you
  only want OSC to fire during a live show.

This distinction is **NOT documented** in the Disguise developer site's
transports guide, which only shows `remote_transports` examples. It is
field knowledge from operators with deep Designer experience.

## Wrong vs right

**WRONG** for plugins (only routes during engaged playback):

```python
tm.remote_transports = list(tm.remote_transports) + [evt_osc]
```

**RIGHT** for plugins (routes always):

```python
tm.local_transports = list(tm.local_transports) + [evt_osc]
```

## Probe references

- `reference-tools/probe_eventtransport_osc.py` — added to
  `remote_transports`, `fieldActivity` stayed empty even with packets
  arriving
- `reference-tools/probe_eventtransport_osc_v2.py` — final form, added
  to `local_transports`, behaviour was correctly tested

## CLAUDE.md candidate

This should be flagged in `docs/reference.md` Known Crashers / pitfalls
section. It's not a crasher per se but a silent functional failure that
is hard to diagnose because there's no error path — the OSC packet is
received correctly and then dropped on the floor by the routing layer.

## Related

- [osctester-is-not-a-receive-consumer.md](osctester-is-not-a-receive-consumer.md)
- [loadorcreate-hook-blocks-all-types.md](loadorcreate-hook-blocks-all-types.md)
- [disguise-docs-as-source-of-truth.md](../patterns/disguise-docs-as-source-of-truth.md)
