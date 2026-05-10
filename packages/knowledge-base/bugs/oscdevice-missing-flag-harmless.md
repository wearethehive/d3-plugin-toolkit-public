---
type: bug
status: confirmed
severity: cosmetic
tested: "2026-04-08"
---

# OscDevice "Cannot send, no ip address specified" Banner Is Harmless

## Symptom

A freshly-constructed `d3.OscDevice()` shows a red banner in Designer's
device list and editor panel:

```
[ERROR] : Cannot send, no ip address specified
```

This appears the moment the device is created and persists until
`sendIPAddress` is set to a non-empty value.

## Why it's harmless

A fresh `OscDevice` has `sendIPAddress = ""` by default. The error
banner only blocks the **send** path, which most plugins don't use.

The device still **receives** OSC packets normally with this banner
showing. This was confirmed during the OSC investigation: another
OscDevice with this exact ERROR state was observed receiving packets
and routing them to its internal Recorder (visible in the OSC Recorders
panel).

## Cosmetic fix

Set `sendIPAddress` to any valid IP if you want the banner gone:

```python
import d3
dev = d3.OscDevice()
dev.sendIPAddress = "127.0.0.1"  # or any reachable address
# Banner disappears. No effect on receive behaviour.
```

## Lesson

Don't chase this error during plugin development. It is a UI hint about
an unconfigured optional feature, not a runtime failure. The first
instinct on seeing a red ERROR banner is to assume the device is broken;
in this specific case, it isn't.

## Related

- [osc-port-collision-kernel-binding.md](osc-port-collision-kernel-binding.md)
- [osc-device-lifecycle.md](../patterns/osc-device-lifecycle.md)
