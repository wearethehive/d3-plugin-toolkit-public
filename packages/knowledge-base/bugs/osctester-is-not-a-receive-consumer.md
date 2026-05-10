---
type: bug
status: confirmed
severity: silent-failure
tested: "2026-04-08"
---

# OscTester Is Not a Receive Consumer

## Symptom

`d3.OscTester` exposes properties (`oscDevice`, `receiveAddress`,
`receiveBuffer`, `receiveBufferCapacity`, `clearReceiveBuffer`) that look
exactly like an OSC receive surface. Configuring an OscTester with an
OscDevice and a `receiveAddress`, then sending real OSC packets to the
OscDevice's port, results in `receiveBuffer` staying `(Empty)` even
though the packets are clearly arriving — visible in Designer's "OSC
Recorders" panel attached to the OscDevice itself.

## Root cause

`OscTester` is a developer utility for **sending** test OSC messages to
other OSC endpoints from inside Designer. The `receiveBuffer` property
is a **loopback echo** of messages sent via the OscTester's UI, NOT a
capture surface for inbound network traffic. The class name "Tester"
was the disambiguating signal that was missed during initial
investigation.

Designer routes incoming OSC packets to an internal C++ `Recorder`
object owned by the `OscDevice` itself (visible in d3Log as
`OscDevice::acquireRecorder < OscDevice::start`). The Recorder is not
exposed to Python and is consumed only by Designer's GUI Recorders
panel. OscTester is a separate class with a separate purpose and is not
in the receive routing chain.

## Wrong vs right

**WRONG** — trying to read `OscTester.receiveBuffer` as a Python plugin's
OSC capture surface:

```python
import d3
tester = d3.OscTester()
tester.oscDevice = some_osc_device
tester.receiveAddress = "/cue/fire"
# Send real OSC packets to some_osc_device's port...
buf = tester.receiveBuffer  # ALWAYS (Empty) — this is a loopback display, not a packet sink
```

**RIGHT** for transport actions — use `EventTransportOSC` with one of
its built-in input fields (`play`, `stop`, `cue`, `floatCue`, `track_id`,
etc.). Designer routes the OSC packet to the matching transport action
automatically:

```python
import d3
evt = d3.EventTransportOSC()
evt.path = "objects/eventtransportosc/my-osc.apx"
evt.osc_device = some_osc_device
# bind addresses on evt.cue / evt.play / evt.stop fields
tm.local_transports = list(tm.local_transports) + [evt]
```

**RIGHT** for plugin-defined actions — launch a companion process via
`subprocess.Popen` and bridge via WebSocket. Python plugins cannot read
OSC packet contents directly. See
[subprocess-from-sandbox.md](../patterns/subprocess-from-sandbox.md).

## Probe references

- `reference-tools/probe_osctester_revisit.py` — initial revisit attempt
- `reference-tools/probe_osctester_diagnose.py` — diagnostic that
  confirmed `receiveBuffer` is loopback-only

## Related

- [c++-binding-non-exception-failures.md](../patterns/c++-binding-non-exception-failures.md)
- [disguise-docs-as-source-of-truth.md](../patterns/disguise-docs-as-source-of-truth.md)
- [eventtransport-local-vs-remote-engaged-rule.md](eventtransport-local-vs-remote-engaged-rule.md)
