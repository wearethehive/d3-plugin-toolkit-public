---
type: bug
status: confirmed
severity: error
tested: "2026-04-08"
---

# OscDevice Port Collision: Kernel Binding Is Not Released on stop()

## Symptom

Two `OscDevice` resources configured for the same `receivePort` do NOT
share the kernel UDP socket. The first device to call `start()` owns
the kernel binding; the second binds at the API level (`started == True`)
but receives nothing. The "stuck" device reports `started: True` and
`receiving: False` and never sees any packets, even when packets are
confirmed arriving on its configured port (visible via the other device
on the same port).

## Critical detail

Stopping a device via `dev.stop()` or removing it from
`DeviceManager.devices` does **NOT** release the kernel binding. Only
changing the device's `receivePort` to a different value (which forces
a rebind) or full project teardown releases the original socket.

## Diagnostic

```python
import d3
collisions = {}
for i in range(len(resourceManager.allResources(d3.OscDevice))):
    dev = resourceManager.allResources(d3.OscDevice)[i]
    port = dev.receivePort
    collisions.setdefault(port, []).append(dev)
# Look for ports with len > 1, and orphaned devices with path == ""
# from constructor-only attempts that never got persisted but linger
# in DeviceManager.
```

## Workaround

Change the conflicting device's `receivePort` to a parking value (e.g.
`7499`) and restart it. The rebind releases the original socket, freeing
the port for another device to claim:

```python
stuck.receivePort = 7499
stuck.stop()
stuck.start()
# Original port is now free for the intended owner.
```

## Default ports to AVOID

- `7400` — Designer's default OSC SEND port
- `7401` — Designer's default OSC RECEIVE port

For plugin-owned `OscDevice` resources, pick a high port in the IANA
dynamic range (49152-65535). **Recommended: `38301`** or similar,
configurable per plugin. Hardcoding 7400/7401 in plugin code guarantees
a collision with Designer's own defaults.

## Probe references

- `reference-tools/probe_osc_port_check.py` — diagnostic to enumerate
  collisions
- `reference-tools/probe_osc_release_socket.py` — confirmed that
  `stop()` does NOT release the kernel socket
- `reference-tools/probe_osc_clear_collisions.py` — port-rebind workaround

## Related

- [osc-device-lifecycle.md](../patterns/osc-device-lifecycle.md)
- [eventtransport-local-vs-remote-engaged-rule.md](eventtransport-local-vs-remote-engaged-rule.md)
