---
type: pattern
status: confirmed
tested: "2026-04-07"
---

# OscDevice Lifecycle and "Added vs Dormant" Detection

## Concept

Designer distinguishes between **OscDevice resources that exist in the
project bin** (dormant — visible in the resource browser, persisted with
the project, but not running) and **OscDevices that are actively part of
the running configuration** (added, in the `DeviceManager.devices` list,
their UDP threads spawned and listening).

A dormant OscDevice has `started == False` and is absent from
`DeviceManager.devices`. An added OscDevice appears in the list and may
or may not be `started` — `start()`/`stop()` are independent of
membership.

## Locating the DeviceManager

`guisystem.session.devices` may be unavailable in the sandbox. The
reliable path is:

```python
import d3
dm = resourceManager.allResources(d3.DeviceManager)[0]
# dm.path is typically "objects/devicemanager/default.apx"
```

## Detection: added vs dormant

```python
def is_added(device, dm):
    target = str(device.path)
    return any(str(d.path) == target for d in dm.devices)
```

## Adding a device to the project

`DeviceManager.devices` is a list-typed property. Mutate by reassignment:

```python
dm.devices = list(dm.devices) + [my_osc_device]
```

Creating an OSC device with `resourceManager.loadOrCreate("devices/<name>.apx",
OscDevice)` is suitable for user-facing devices. After setting ports/IP fields,
add it to the active device list if it is not already present.

## Removing a device from the project

```python
dm.devices = [d for d in dm.devices if str(d.path) != target_path]
```

## Starting / stopping the runtime listener

```python
device.start()    # spawns OscUdpReceiveThread + OscUdpSendThread
device.started    # -> True
device.receiving  # -> True when packets arriving
device.stop()
device.started    # -> False
```

Designer logs the thread creation and start/stop events to its console.

## Full create + add + start + cleanup example

```python
import d3
rm = resourceManager
dm = rm.allResources(d3.DeviceManager)[0]

# Create new device by duplicating an existing one (or use d3.OscDevice()
# constructor — also confirmed working, see probe_osccommand_creation.py)
template = rm.allResources(d3.OscDevice)[0]
new_path = "objects/oscdevice/plugin_osc_input.apx"
device = template.duplicate(new_path)
device.receivePort = 17401
device.sendPort = 17400

# Add to active list
dm.devices = list(dm.devices) + [device]

# Start UDP listener
device.start()

# ... use it ...

# Teardown
device.stop()
dm.devices = [d for d in dm.devices if str(d.path) != new_path]
rm.remove(new_path)
```

## Key fields on OscDevice

| Field | Type | Notes |
|---|---|---|
| `receivePort` | int | UDP port to listen on |
| `sendPort` | int | UDP port to send to |
| `sendIPAddress` | str | Destination for outgoing |
| `ipFromFilter` | str | Filter incoming by sender IP; blank = any |
| `started` | bool | Runtime state (read after `start()`) |
| `receiving` | bool | Whether packets are currently arriving |
| `status` | (varies) | Connection status |

Additional configurable fields observed on the device surface:

| Field | Notes |
|---|---|
| `supportsSendingMessageBundles` | Boolean toggle for bundle sending support |
| `verboseSend` | `1` enables verbose send logging, `0` disables it |

When deleting a device, remove it from `DeviceManager.devices` before deleting
the resource. Stop it first if it may have an active listener.

## Related

- `reference-tools/probe_device_manager.py` — full lifecycle test
- `reference-tools/probe_osc_inventory.py` — initial OSC subsystem inventory
- `bugs/layer-add-gui-side-effect.md` — GUI exception fired when adding layers from script (related risk class)
