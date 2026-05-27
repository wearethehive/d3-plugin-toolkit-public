# Designer API Reference

Loaded on demand. Read this in full before writing any Python that executes on Designer.

---

## d3 Fundamentals

- **d3 runs at 1 beat per second by default** — but `track.timeToBeat(seconds)` and `track.beatToTime(beats)` exist for non-60 BPM projects. Use these conversion methods when BPM may differ
- **`Resource.description` is read-only** — derived from path filename. Use desired name in `loadOrCreate` path
- **`Vec` and `Vec3` are aliases** — they are identical types
- **VideoClips are auto-created** — drop files into `objects/VideoFile/` and d3 auto-creates `VideoClip` resources. Query `allResources(VideoClip)` to get their paths
- **All resource paths MUST be lowercase** — `objects/<type>/[subfolder/]<name>.apx`
- **OSC in expressions: `/` becomes `.`** — `/my_addr` → `osc:my_addr`, `/show/selector` → `osc:show.selector`
- **Never assume resource paths** — always query d3 for existing resources before referencing them
- **Project checkpoints** — `resourceManager.saveAll()` flushes all pending saves to disk

---

## Python Execution

- Endpoint: `POST http://{host}:{port}/api/session/python/execute`
- Body: `{ "script": "python code" }`
- Response: `{ status: { code, message }, d3Log, pythonLog, returnValue }`
- Python 2.7 sandbox — no f-strings, no threading, no sys
- Available stdlib: `os`, `csv`, `re`, `json`, `collections`, `datetime`, `traceback`
- `os.path`, `os.makedirs`, `os.getcwd()` all work
- `open(path, 'w', newline='')` works (with `TypeError` fallback to `'wb'` for Py2 csv compat)
- **Execution is blocking** — scripts run on the main application thread, Designer UI freezes during execution. Keep scripts short; chain multiple calls rather than one long script.
- **No `from x import *`** — scripts run inside a generated function body (`def userScript(): ...`), so wildcard imports are invalid
- **No state persistence** between `execute` calls — use registered modules for persistent state
- **Must NOT be polled** — the execute API is for show programming, not frame-level telemetry. Use the Live Update API for real-time data.
- **Timeout**: governed by `pythonApiExecutionTimeout` experimental option; exceeding it triggers `KeyboardInterrupt` and returns `TimeoutError`

### Registered Modules
- Endpoint: `POST api/session/python/registermodule` with `{"moduleName": "name", "contents": "code"}`
- All variables/methods/classes defined in the module are accessible without import in subsequent `execute` calls that specify the same `moduleName`
- **Cross-module imports** require the `user_module_` prefix: `from user_module_<name> import ...`
- Module naming: alphanumeric plus `.`, `-`, `_`; cannot start/end with punctuation
- **Auto-loading**: modules auto-load from `{project_root}/plugins` on startup — directories with `__init__.py` load by directory name; `.py` files load by filename

### Response Quirks
- Strings are double-quoted: `"\"hello\""` → strip outer quotes
- Newlines escaped: `\\n` → unescape to `\n`
- Return `None` comes back as string `"None"`
- Error line numbers are offset by ~10 — scripts run inside an implicit `userScript` wrapper
- `d3Log` may contain output from other threads — use `pythonLog` for clean Python output and `returnValue` for structured data

---

## Python 2.7 Rules

- Use `%` or `.format()` for string formatting — NOT f-strings (Python 2.7)
- `for x in collection` works on d3 lists (confirmed in official docs), but `range(len())` is safer in registered modules
- `uptime` is globally synchronized across servers; `time` is track-relative — critical for multi-machine setups
- Use `getattr(obj, 'attr', None)` for safe attribute access
- Use `basestring` check for string detection (with NameError fallback)
- `trackTime()` returns current track time in seconds; `runningTime()` includes hold duration at section end
- Both `trackTime()` and `runningTime()` are only available in the default namespace, NOT in registered modules (use `guisystem.player.tCurrent` instead)
- `except Exception:` is unreliable in Designer's embedded runtime. Use bare `except:` for Designer API guard blocks. If the exception object is genuinely needed, use `except BaseException as e:`. See `packages/knowledge-base/bugs/except-exception-does-not-catch-valueerror.md`.

---

## CRITICAL: Two Different `d3` Objects

- The global `d3` is the **APPLICATION** instance — has `projectPaths`, `projectFolder`, `state`
- Types like `Indirection`, `VideoFile`, `Track`, `ListIndirectionController` are on the **MODULE**: `import d3`
- Scripts must `import d3` to access types
- `d3.ResourceManager.get()` → HTTP 500. Use the `resourceManager` global instead

---

## Key Globals (pre-injected, always available)

- `resourceManager` → ResourceManager instance
- `guisystem.track` → current track
- `guisystem.currentTransportManager` → transport manager (playback, speed, volume, cue jumps)
- `state` → D3State (has `state.stage`, `state.devices`)
- `state.devices` → DeviceManager (OSC devices, expression variable devices, DMX, etc.)
- `system.scenes` → list of scenes (FeedScene, etc.)
- `d3NetManager` → D3Net manager (machine discovery, remote command dispatch)
- `trackTime()` → playhead position in seconds (unavailable in registered modules — use `guisystem.player.tCurrent`)
- `d3.projectPaths.projectFolder` → project directory
- Common types: `Vec2(x,y)`, `Vec(x,y,z)` / `Vec3`, `Int2(w,h)`, `Rect()` (set x0/y0/x1/y1 individually), `float4(x,y,z,w)`
- `type(obj).__username__` → user-visible type name for any d3 object (e.g. "Video Layer", "OSC Device")

---

## Resource Management

```python
resourceManager.loadOrCreate(path, Type)  # create or load
resourceManager.allResources(Type)        # list all of a type
resourceManager.load(path, Type)          # load existing — ALWAYS pass Type arg
resourceManager.deleteResource(obj)       # delete resource and its file
resourceManager.saveAll()                 # flush all pending saves
resource.save()                           # save immediately
resource.saveOnDelete()                   # defer save to batch — standard save method, call AFTER changes
resource.duplicate(newPath)               # deep copy to new path
resource.notifyCreate()                   # call after loadOrCreate
resource.activate()                       # perform resource initialization
markDirty(resource)                       # call BEFORE modifying — only individual Resources, not containers/lists
```

### Save Pattern (from official docs)
```python
markDirty(sub_resource)          # BEFORE changes
sub_resource.property = new_val  # make changes
parent_resource.saveOnDelete()   # AFTER changes — defers to batched save
```
- Unnamed resources (no path, e.g. Layers) transfer lifecycle to parent — save the `namedParent`
- For container changes, `markDirty` both sub-resource and parent

---

## Layer API

```python
layer = track.addNewLayer(d3.VariableVideoModule, start_beats, length_beats, "LayerName")
```
- Exactly 4 arguments — wrong count causes RuntimeError or crash (not catchable)
- **Keyframe times are absolute track beats, NOT layer-relative** — this is the most common source of bugs
- Standard layer length is 15 seconds (15.0 beats)
- Each new layer is placed ON TOP of stack. Create in reverse order for correct numbering
- **Layer list order has NO relationship to timeline position** — first in list can be last on timeline
- `track.moveLayer(layer, new_index)` — reorder layers
- `track.removeLayer(layer)` — remove a layer
- `layer.name` — readable AND writable (Layer is an exception, uses `name` not `description`)
- `layer.tStart`, `layer.tLength`, `layer.tEnd` — time extents (all writable)
- `layer.enabled = True/False` — enable/disable a layer
- `layer.moduleType()` — get the module type
- `layer.sequences` — list ALL FieldSequence objects on a layer (use instead of guessing names)

## KeySequence API

**CRITICAL:** `findSequence()` returns `None` silently if the property doesn't exist on that layer type — always check the return value.

```python
fseq = layer.findSequence("brightness")    # FieldSequence
keyseq = fseq.sequence                     # KeySequence
```

- **Float at time:** `keyseq.setFloat(track_beat, value)`
- **Float at index:** `keyseq.key(i).v = value`
- **Resource at time:** `keyseq.setResource(track_beat, resource_obj)`
- **Resource at index:** `keyseq.key(i).r = resource_obj`
- **String at time:** `keyseq.setStringAtT(track_beat, value)`
- **String at index:** `keyseq.setString(i, value)`
- **KeyContainer at time:** `keyseq.insertKeyContainer(time, index, key_container)`
- **Insert key:** `keyseq.insert(index, time_in_beats, key_type)`
- **Remove key:** `keyseq.remove(index, 1)`
- **Clear all but first:** `keyseq.stripToFirstKey()`
- **Enable multi-keyframe:** `fseq.disableSequencing = False` (confusing double-negative — `False` = sequencing ON)
- **Evaluate at time:** `fseq.eval(track_beat, default_value)`

## Expressions API

Set expressions on any FieldSequence to drive values dynamically:
```python
fseq = layer.findSequence("brightness")
fseq.setExpression("self * 0.5")                             # scale existing keyframe value
fseq.setExpression("0.5 + 0.5 * math.sin(time * math.pi)")  # time-based animation
fseq.setExpression("module:OtherLayer.brightness")           # cross-layer link
fseq.setExpression("osc:my.address")                         # OSC input
fseq.setExpression("if(time > 5, 1, 0)")                    # conditional
fseq.setExpression("self")                                   # clear expression (restore keyframes)
fseq.setExpression("getByUID(0x123875234)")                  # UID-based access (survives renames)
```

### Expression Gotchas
- **`time` vs `uptime`:** `time` is track-relative (seconds since track start). `uptime` is globally synchronized across all servers — critical distinction for multi-machine setups
- **Spaces in names become underscores:** layer "My Layer" → `module:My_Layer.brightness`
- **UID-based access** (`getByUID(0x...)`) survives resource renames; name-based references break on rename
- **Prefix modifiers:** `limit::expr` (clamp to field range), `scale::expr` (map 0-1 to full range)
- **External protocols:** `osc:/address`, `dmx:universe.address`, `midi:note`
- Accessing undefined resource fields causes expression failure silently

### ExpressionVariablesDevice (custom expression variables)
```python
import d3
device_path = "devices/{}".format(device_name)
var_device = resourceManager.loadOrCreate(device_path, ExpressionVariablesDevice)
device_manager = state.devices
if var_device not in device_manager.devices:
    device_manager.devices.append(var_device)
var_container = var_device.container
var_container.variables.append(ExpressionVariable())
new_var = var_container.variables[-1]
new_var.name = "my_variable_name"
new_var.type = ExpressionVariable.FloatType
new_var.defaultFloat = 5
# Use in any expression: fseq.setExpression("my_variable_name * 2")
```

---

## Transport Control

Programmatic playback control via `TransportCommand`:
```python
transport_manager = guisystem.currentTransportManager

# Create a command, then execute it — commands do NOTHING until addCommand()
cmd = TransportCommand.makeJumpToBeat(state, transport_manager, 32.0)
transport_manager.addCommand(cmd)

# Available command factories:
cmd = TransportCommand.makePlayMode(state, transport_manager, mode)
cmd = TransportCommand.makeSetSpeed(state, transport_manager, 1.0)
cmd = TransportCommand.makeBrightness(state, transport_manager, 0.8)
cmd = TransportCommand.makeVolume(state, transport_manager, 0.5)
cmd = TransportCommand.makeJumpToCue(state, transport_manager, xx, yy, zz, cue_mode)
cmd = TransportCommand.makeNudgeBeat(state, transport_manager, delta)
cmd = TransportCommand.makeNudgeSection(state, transport_manager, delta)
cmd = TransportCommand.makeNudgeTrack(state, transport_manager, delta)
```

### Additional Command Factories
```python
cmd = TransportCommand.makeJumpToFrame(state, transport_manager, frame)
cmd = TransportCommand.makeJumpToTime(state, transport_manager, time_seconds)
cmd = TransportCommand.makeNudgeFrame(state, transport_manager, delta)
cmd = TransportCommand.makeJumpToMidiNote(state, transport_manager, note)  # returns None if note invalid
```
- `makeJumpToMidiNote` returns `None` on invalid note (no exception) — always check return value
- The `transport_manager` in command creation must match the manager that executes `addCommand`
- To switch tracks on a live transport, nudge through `tm.setList.tracks` with `TransportCommand.makeNudgeTrack(...)`. Setting `trackToLoad` only affects the default track loaded before commands are received.

### OSC Transport
```python
osc_transport = next((t for t in transport_manager.remote_transports if isinstance(t, EventTransportOSC)), None)
```

### Timecode Transport
```python
tc_transport = transport_manager.timecode
tc_status = tc_transport.statusString
tc_type = tc_transport.SMPTE_clock_type
```
- SMPTE frame rate access only works with SMPTE/LTC timecode type

---

## Time Conversion

```python
track = guisystem.track
beats = track.timeToBeat(seconds)
seconds = track.beatToTime(beats)
# Calculate duration in beats from seconds:
length_beats = track.timeToBeat(start_seconds + duration_seconds) - start_beats
```
Note: At default 60 BPM, beats == seconds. Use these methods when BPM may differ.

---

## Devices API

```python
device_manager = state.devices
devices = device_manager.devices

# Find by type
dmx_devices = [d for d in device_manager.devices if isinstance(d, DmxDevice)]

# Find by name
my_device = next((d for d in device_manager.devices if d.description == "MyDevice"), None)

# User-visible type name
type_name = type(device).__username__

# OSC device configuration
osc_device.receivePort = 8000
osc_device.sendPort = 8001
osc_device.sendIPAddress = "127.0.0.1"

# Delete a device
device_manager.deleteDevice(device)
```
Note: `device_manager.devices.append(device)` works for devices (unlike `ctrl.resources.append`).
- **Device `.save()` is mandatory** for persistence — changes are not auto-saved
- **`.reload()` silently discards** unsaved changes without warning

---

## Audio Control

```python
# Audio layer volume via keysequence
audio_layer = next((l for l in guisystem.track.layers if l.name == "MyAudioLayer"), None)
vol_seq = audio_layer.findSequence("volume")
vol_seq.disableSequencing = False
key_seq = vol_seq.sequence
key_seq.setFloat(0.0, 0.5)

# Master transport volume
transport = guisystem.currentTransportManager
transport.volume = 0.8
```

---

## GroupLayer

```python
track.groupLayers(layers_list, "Group Name", False)  # GroupLayer (regular)
track.groupLayers(layers_list, "Group Name", True)   # SmartGroupLayer
track.ungroupLayer(group)                             # dissolve group
```
- `d3.GroupLayer(layers)` constructor does NOT work (Python 2 binding bug)
- `track.groupLayers(layers, name, smart)` is the correct method (confirmed 2026-03-25)
- Removing a group via `track.removeLayer(group)` also removes its children
- `group.layers` — list of child layers
- `group.nLayers()` — child count
- `group.expanded` — read/write
- `track.makeArrow(src_layer, dst_layer)` — create arrow between layers

---

## Indirections (Content Switching)

Three objects: **Indirection** (wrapper) → **Controller** (resource list + logic) → **Resources**
- Assign to layer using the **Indirection** path, NOT the controller path
- `selectedIndexExpressionText` drives index via expression (e.g. `osc:my_selector`)
- Controller types: List, OSC, Keyed, Manual, Sequenced

**Creating and binding indirection to a layer (CONFIRMED WORKING 2026-03-18):**
```python
import d3

ind = resourceManager.loadOrCreate("objects/indirection/name.apx", d3.Indirection)
ind.expectedType = VideoClip  # CRITICAL — without this, invisible in media picker
ctrl = resourceManager.loadOrCreate("objects/listindirectioncontroller/name.apx", d3.ListIndirectionController)
ind.controller = ctrl

# List assignment only — .append() crashes
ctrl.resources = [clip1, clip2]
ctrl.selectedIndexExpressionText = "osc:my.selector"

ind.notifyCreate(); ind.activate(); ind.save()
ctrl.notifyCreate(); ctrl.activate(); ctrl.save()

# Bind to layer video field
fseq = layer.findSequence("video")
ks = fseq.sequence
n = ks.nKeys()
if n and n > 0:
    ks.remove(0, n)
ks.insertKeyContainer(layer.tStart, 0, ind)
```

---

## Feed API

```python
# Access feed scenes
feed_scene = next((s for s in system.scenes if isinstance(s, FeedScene) and s.name == "MyFeedScene"), None)

# Feed rectangles (output mapping regions)
rects = feed_scene.feedRects           # list of FeedRect
new_rect = feed_scene.add()            # create new FeedRect
feed_scene.remove(rect)                # remove FeedRect
used_heads = feed_scene.getUsedHeads() # which output heads are in use

# Configure output head
head_config = feed_scene.ensureHeadConfig(0, Int2(1920, 1080))
head_config.resolution = Int2(1920, 1080)
head_config.clearColour = Colour(0.0, 0.0, 0.0, 1.0)
head_config.framesLatency = 2
head_config.name = "Main LED"

# FeedRect properties
feed_rect.screen = my_screen           # assign to screen object
feed_rect.head = 0                     # output head index
feed_rect.rect.x = 100                 # pixel position
feed_rect.rect.w = 1920                # pixel width
feed_rect.screenRect.u = 0.0           # UV mapping
feed_rect.screenRect.v = 0.0
feed_rect.screenRect.uw = 1.0
feed_rect.screenRect.vh = 1.0
feed_rect.rotationIndex = 1            # rotation (0=0deg, 1=90deg, 2=180deg, 3=270deg)
feed_rect.active                       # is active (read)
feed_rect.mask = mask_texture           # DxTexture for masking

# DeformStack (warping)
deform_stack = feed_rect.deformStack
deform_stack.clear()
lens_deform = deform_stack.add(DeformStackItem_Lens)
lens_deform.enabled = True
lens_deform.amount = 0.5
circular_deform = deform_stack.add(DeformStackItem_Circular)
circular_deform.innerRadius = 0.2
circular_deform.outerRadius = 0.8
mesh_deform = deform_stack.add(DeformStackItem_Mesh)
mesh_deform.mesh = mesh_resource       # Mesh object

# Assign feed scene to projection, then projection to layer
feed_projection.feed_scene = feed_scene
video_layer.projection = feed_projection

# Machine output config
machine = system.machines[0]
card_type = machine.vfcCardType(0)     # VFC card info
num_ports = machine.vfcNumPorts(0)
port_settings = machine.vfcPort(slot_index, port_index)
output_settings = machine.output(0)
output_settings.resolution = Int2(1920, 1080)
output_settings.rate = 59.94
output_settings.bitDepth = machine.BITS_10
```

Key types: `FeedScene`, `FeedRect`, `FeedHeadConfig`, `FeedProjection`, `DeformStack`, `DeformStackItem_Lens`, `DeformStackItem_Circular`, `DeformStackItem_Mesh`, `Colour`, `DxTexture`, `Mesh`, `OutputSettings`

Globals: `system.scenes`, `system.machines`, `project.projections`, `project.meshes`

---

## Calibration API

Three calibration systems for projectors:

```python
# OmniCal (automated, camera-based)
omnical = Resource.opticalCalibrator
task = omnical.requestCapture()       # returns task object
task = omnical.requestCalibrate()
task.running()                         # bool — poll for completion
task.progress()                        # 0.0 to 1.0
task.success()                         # bool — check result

# QuickCal (semi-automated)
plan = Resource.ManualAlignmentPlan
plan.addAlignmentCoordinate(...)

# Manual calibration — direct property access
proj.calibration.lensShift = Vec2(x, y)
proj.calibration.throwRatio = 1.5
proj.calibration.position = Vec(x, y, z)
proj.calibration.rotation = Vec(rx, ry, rz)
```
- OmniCal tasks are async — must poll `.running()` and `.progress()` to track completion

---

## Stage API

```python
stage = state.stage

# Collections
stage.lights                    # all lights
stage.dmxLights                 # DMX-controlled lights
stage.displays                  # all displays (note: consolidates multiple arrays — contains duplicated data)
stage.surfaces                  # projection surfaces
stage.people                    # tracked people
stage.pucks                     # tracked pucks (unnamed — use array index)

# All 3D objects share these properties
obj.offset = Vec(x, y, z)      # position
obj.rotation = Vec(rx, ry, rz) # rotation
obj.scale = Vec(sx, sy, sz)    # scale (default mesh is 1m x 1m)
obj.mesh                        # mesh resource
obj.resolution = Int2(w, h)    # pixel resolution

# Search by name
surface = next((s for s in stage.surfaces if s.description.lower() == "surface 1"), None)
```
- `stage.venue` can be `None` — always check before accessing `.props`
- Pucks are unnamed; use array index to identify them

---

## Video Input API

```python
# Find video input clips
all_clips = resourceManager.allResources(VideoClip)
live_clips = [c for c in all_clips if c.isVideoIn]

# Video input properties
clip.isVideoIn                                    # True if live input
clip.Video_Input.localVideoIn.name                # input source name
clip.Video_Input.localVideoIn.hardwareId          # hardware identifier
clip.Video_Input.localVideoIn.videoInFormat.resolution  # Vec2
clip.Video_Input.localVideoIn.videoInFormat.framerate   # float
clip.Video_Input.localVideoIn.videoInFormat.pixelFormat # string

# Configure video input
clip.Video_Input.localVideoIn = video_in_device   # assign input device
clip.Video_Input.localVideoIn.setFormat(Vec2(1920, 1080), False, "YUV422")
clip.Video_Input.localVideoIn.pixelFormat = "RGB24"
clip.Video_Input.localVideoIn.resolution = Vec2(1280, 720)
clip.Video_Input.localVideoIn.cropRectangle = Rect(0, 0, 640, 480)

# ACES color transform
clip.Video_Input.localVideoIn.acesTransform = AcesInputTransformParameters(type, space, curve)

# Preview frame
preview = clip.Video_Input.localVideoIn.getPreviewFrame(Int2(320, 180))

# System-level video input management
channels = VideoInSystem.inputChannels            # all input channels
device = VideoInSystem.findVideoIn(hardwareId)    # find by hardware ID
logical = VideoInDeviceMap.getLogicalDevices()     # logical device list
groups = VideoInSystem.captureGroupsAvailable      # capture groups
auto = VideoInSystem.autoMappedChannels            # auto-mapped channels

# Advanced: teamed and multiview inputs
teamed_id = VideoInSystem.makeTeamedVideoInHardwareId([id1, id2])
multiview_id = VideoInSystem.makeMultiviewVideoInHardwareId(sourceHardware, regionOfInterest)
```

Key types: `VideoClip`, `VideoInSystem`, `VideoInDeviceMap`, `AcesInputTransformParameters`, `Rect`, `Vec2`, `Int2`

---

## API Version Changes (Breaking)

Track these when targeting specific Designer versions. Full changelog: https://developer.disguise.one/python-api/api-changes

**r30.8:** `D3State.track`, `D3State.player`, `D3State.currentTransportManager` all moved to `GuiSystem.*`. This is why modern code uses `guisystem.track` not `state.track`.

**r32.0:** New `FieldSequence` class. `Layer.module` **removed** — do not access it. `VideoClip` gained `hasAudio`, `enabledVersion`, `proxyInfo`.

**r32.3:** `Vec2.round()` **removed** — use `roundClosest()` or `roundDown()`. New: `KeySequence.layer`, `KeySequence.keys`, `Stage.displays`, MIDI device properties.

**r32.4 (current, 2026-03-09):** 24 new classes including OCIO color management suite (`OCIOModule`, `OcioModuleInputTransform`, etc.), content viewpoints (`ContentViewPoint`), camera/object tracking (`ObjectTracking`, `CameraTracking`, `TrackedLensEncoderData`), `SceneAnimationModule`. Breaking: `RenderStreamLocalModuleConfig.getMachinesFromMapping` param changed from `Projection` object to `int` UID. Removed: `OptiCalStagePlan.nAliveCameras()` (use `nAliveMVPlanCameras()`), `isVimbaInstalled()` (use `isVimbaXInstalled()`).

---

## Known Crashers

| Call | Result | Fix |
|------|--------|-----|
| `d3.ResourceManager.get()` | HTTP 500 | Use `resourceManager` global |
| `state.track` | HTTP 500 | Use `guisystem.track` |
| `track.name` | HTTP 500 | Use `track.description` |
| `track.addLayer()` / `track.layers.append()` | HTTP 500 | Use `addNewLayer` |
| `dir()` on d3 objects with Action properties | crash | Don't call `dir()` on d3 objects |
| `seq.setResource(t, indirection)` | ACCESS_VIOLATION at render | Use `insertKeyContainer` for Indirection. `setResource` works fine for VideoClip |
| `seq.setString(0, path)` for resource fields | HTTP 500 | Use `keyseq.setResource(t, resource)` or `insertKeyContainer` |
| `seq.key(0)` on KeyAsKeyContainer type | native crash, uncatchable | Use `keyseq.setResource(t, r)` or `fseq.eval()` instead. KeyFloat `.v` and KeyResource `.r` ARE safe |
| `os.makedirs()` in project folder mid-session, **unguarded** | can crash Designer | Never speculatively create dirs. If guarded by `os.path.exists()` first AND wrapped in bare `except:`, the call is defensive and acceptable — but prefer returning a structured error to the caller instead of speculative creation. |
| `resourceManager.load(path)` without type arg | returns base `Resource`, crashes on type access | Always pass Type: `load(path, Type)` |
| `ctrl.resources.append(clip)` | HTTP 500 | Full list assignment: `ctrl.resources = [...]` |
| `import d3` at module level in registered modules | HTTP 500 on execute | Put `import d3` inside each function body |
| `trackTime()` in registered modules | NameError | Use `guisystem.player.tCurrent` |
| `resource.reloadExternal()` on Indirection/controller | ACCESS_VIOLATION | Do not call |
| Generic controller path `objects/indirectioncontroller/` | runtime access violations | Use type-specific paths: `objects/listindirectioncontroller/`, etc. |
| Missing `ind.expectedType = VideoClip` | invisible in media picker | Always set after creation |
| VideoFile passed to Indirection controller | wrong type crash | Controllers expect VideoClip, not VideoFile |
| ~~`layer.module` (r32.0+)~~ | **RETIRED 2026-04-07** | Confirmed working on r32.4 by `reference-tools/probe_layer_module_r32.py`. The returned object is base `Layer`, and `.module` is the canonical access path to the typed module (e.g. `OscControlModule`, `VariableVideoModule`). Re-fetching via `track.layers` iteration also works. See `patterns/layer-module-access.md`. Original entry was either incorrect, scoped to a r32.0 transitional state, or referred to a different attribute. |
| `Vec2.round()` (r32.3+) | removed method | Use `roundClosest()` or `roundDown()` |
| `state.track` / `state.player` (r30.8+) | HTTP 500 | Use `guisystem.track` / `guisystem.player` |
| Blocking subprocess calls (`subprocess.call`, `subprocess.run`, `os.system`, `os.popen`) | Hangs Designer main thread; killed by execution monitor (~4s limit). May briefly freeze the render loop. | Use `subprocess.Popen` only, with `creationflags=CREATE_NO_WINDOW` and `stdout/stderr/stdin=DEVNULL`. Never call `.wait()`/`.communicate()`/`.stdout.read()` on the returned Popen. See `patterns/subprocess-from-sandbox.md`. |
| `EventTransportOSC` added to `tm.remote_transports` for plugin OSC reception | Silent functional failure: routes only when `tm.engaged == True`, breaks during pre-show / rehearsal / programming. | Add to `tm.local_transports` instead — local transports route regardless of engaged state. Undocumented in Disguise transports guide; see `bugs/eventtransport-local-vs-remote-engaged-rule.md`. |
| `OscTester.receiveBuffer` for inbound OSC capture | The buffer is a loopback echo for messages SENT via OscTester's UI; OscTester is a developer test-message *sender*, not a receive consumer. The buffer stays empty regardless of received traffic. | OscTester is the wrong primitive. For transport actions use `EventTransportOSC` in `local_transports`. For arbitrary OSC values use a companion app — Designer's OSC reception is not exposed to plugin Python. See `bugs/osctester-is-not-a-receive-consumer.md`. |
| `setattr` on `_blipValue` instances with non-existent attribute names | Silently succeeds, returns no error, value is stored on the Python wrapper instance only and lost on save/load. Probe scripts can mistake this for "the attribute is real." | Always check `dir(type(obj))` before assigning, OR read back via `getattr` and verify the value persisted. See `patterns/python-attribute-assignment-is-permissive.md`. |
| `ReflectionCallable` methods (`MetaField.get`, `Recorder.*`, internal C++ surface) called from Python | Raises errors that DO NOT subclass `Exception`. `try: ... except Exception:` does NOT catch them. The method is exposed in `dir()` but not callable from plugin Python in a meaningful way. | Bare `except:` is required. If a method "fails silently" via a bare-except guard, that's the C++ binding rejecting the call. Don't conclude a Python value-read path doesn't exist just because reflection methods fail — the value may live on a different surface. See `patterns/c++-binding-non-exception-failures.md`. |
| `DxTexture.resize()` then `clear()` / `forceUpload()` | `RuntimeError: isWritingPixels()`; native crash, bypasses try/except | Use `resizeTarget(Int2(w,h), 0, 0, 0, 1, 1)` instead of `resize()`. See `bugs/dxtexture-resize-writing-pixels-crash.md`. |
| `display.getImageMosaic()` / `display.target()` on Director | Native C++ crash / HTTP 500, bypasses try/except | Only call from render machine context. On Director use `Camera.localVisualiserCamera().saveCurrentView(name)` instead. See `bugs/dxtexture-display-methods-crash-on-director.md`. |

---

## Plugin Architecture

Plugins are HTML frontends running in Designer's embedded Chromium (CEF) browser.

### Plugin Types
- **Local (internal):** Live in `{project_path}/plugins/my-plugin/` or shared `common/plugins/`. Travel with the project. HTTP only — no HTTPS, so secure browser APIs (WebUSB, WebBluetooth, WebHID, clipboard) are unavailable. WebGL disabled by default (enable in Advanced Project Settings).
- **Remote:** Auto-discovered via DNS-SD (`_d3plugin._tcp.local.`). Separate frontend/backend, managed at appliance level. Support HTTPS, complex server-side processing, cross-session state.

Toolkit workspace split:

- Local plugins scaffold into `packages/plugins/<name>/` and deploy into a
  Designer project/common plugin folder.
- Remote plugins scaffold into `packages/remote-plugins/<name>/` and are run
  with `npm run cli -- remote <dev|build|smoke|package> <name>`.
- Remote v1 supports Python and Node backend variants. The Python variant uses
  the official `designer-plugin` publisher directly. The Node variant uses a
  Node service plus a small Python publisher sidecar so DNS-SD publishing stays
  on the documented Disguise library path.
- Live DNS-SD smoke test confirmed `designer-plugin` 1.3.1 publishes
  `_d3plugin._tcp.local.` with TXT `t=web`, `s=<requiresSession>`, and
  `d=<isDisguise>`. TXT `u` is only present when `url` is set in
  `d3plugin.json`. See
  `packages/knowledge-base/patterns/remote-plugin-dnssd-publishing.md`.

### Configuration
- Local project plugin `d3plugin.json` manifests should keep the scaffold shape:
  - `"name"`: display name
  - `"description"`: human-readable summary
  - `"version"`: plugin version
  - `"entry": "index.html"`: local plugin entrypoint
  - `"requiresSession"`: optional boolean — whether Designer must have an active session
- Do not replace local project plugin `"entry"` with `"url"` unless a live
  Designer probe has confirmed that exact manifest shape. Remote/DNS-SD plugin
  `url` metadata is a different plugin type and should not be inferred for
  local project plugins. See
  `packages/knowledge-base/patterns/local-project-plugin-manifest-and-preflight.md`.
- Window meta tags (in `index.html`) set initial size only; Designer saves/restores geometry after first open:
  - `disguise-plugin-window-size` — e.g. `"512,512"` (comma-separated)
  - `disguise-plugin-window-min-size` — e.g. `"200,200"`
  - `disguise-plugin-window-resizable` — `"true"` / `"false"`
  - Include both `disguise-plugin-*` and legacy `d3-plugin-*` forms for version compatibility.
  - `window.resizeTo()` does not work in Designer CEF; Designer owns the OS frame.
  - `window.confirm()` always returns `false` in Designer CEF; use inline two-stage button confirmation instead.
  - See `packages/knowledge-base/patterns/plugin-window-sizing.md`.
- Launcher icon: Designer requests `icon.svg` from the plugin web root. In
  Vite plugins, place it at `public/icon.svg` so the build copies it to
  `dist/icon.svg`; app header logos can still be imported from `src/assets/`.
- Discovery: Designer scans project `Plugins/` folder and shared
  `common/plugins/`. Project-specific overrides common plugins with same name.
  If invalid local plugin metadata makes Plugin Launcher report no plugins,
  restoring the file may not be enough; restart all d3 services/processes
  before trusting discovery again. See
  `packages/knowledge-base/bugs/local-plugin-discovery-stale-after-invalid-manifest.md`.
- Theming: Use `@media (prefers-color-scheme: light)` for dark mode. Transparent backgrounds (`rgba(0,0,0,0)`) inherit Designer's blurred aesthetic.

### Build Requirements (Vue 3 + Vite)
- `base: './'` in vite config — required for Designer
- Single-chunk output — no code splitting (CEF compatibility)

### LiveUpdate Notes
- Prefer LiveUpdate subscriptions for realtime read state; use Python exec for
  bootstrap, commands, and data that LiveUpdate cannot expose directly.
- For resources whose names contain spaces, use hex UID object paths such as
  `getByUID(0x...)`; path-derived names like `track:track 1` can fail with
  `UnexpectedToken`.
- Do not subscribe to large `.uid` properties through LiveUpdate. Capture UID
  strings during Python bootstrap and build `getByUID(0x...)` paths there.
- Indexed collection paths can be used as mutation signals. A
  `propertyPathError` changing to a value, or a value changing to
  `propertyPathError`, is an event-driven topology change rather than polling.
- Do not treat LiveUpdate `module.mapping` paths as authoritative for
  keyframed layer mapping membership. Sample the layer's `mapping`
  `FieldSequence` in Python and use live `player.tRender` to select the
  current sample.
- See `packages/knowledge-base/patterns/multitransport-live-surface-stack.md`
  and `packages/knowledge-base/patterns/liveupdate-subscribe.md`.

### Python Execution in Plugins

Use `@disguise-one/designer-pythonapi`. Never inline Python in TypeScript — CEF has a
~20 line body size limit that causes HTTP 500 on larger scripts.

```python
# src/my_module.py
__all__ = ["my_function"]
import json
def my_function():
    return json.dumps({"ok": True})
```
```typescript
import { my_module } from './my_module.py'
const { my_function, registration } = my_module(endpoint)
await registration
const result = await my_function()
```

The `director` hostname is extracted from the URL query parameter `?director=`.

### Registered Helper Module Imports

When plugin Python is split across sibling `.py` files, every helper module must
be imported by the frontend so the Vite loader registers it with Designer.
Registered modules import each other with the runtime name
`user_module_<moduleName>`:

```python
def _helpers():
    import user_module_helpers as helpers
    return helpers
```

The unprefixed module name is not importable in this registered-module context,
and sibling helper source is not bundled into a consumer module's registration
payload. See
`packages/knowledge-base/patterns/registered-python-module-imports.md`.

### Official Libraries
- `@disguise-one/designer-pythonapi` — TypeScript + Vite plugin: converts Python API code into JS modules
- `@disguise-one/vue-liveupdate` — Vue composable for real-time WebSocket read/write of session values
- `disguise-one/python-plugin` (GitHub) — Python library for publishing DNS-SD service records for remote plugins

### Distribution
- Local plugins auto-distribute with the project folder
- Remote plugins need explicit distribution. Toolkit v1 packages remote plugins
  into Windows-first distributable folders/zips; generated installers are a
  future step.
- Submit to Plugin Gallery: email `integrations@disguise.one`

### Guides
- https://developer.disguise.one/plugins/introduction
- https://developer.disguise.one/plugins/getting-started
- https://developer.disguise.one/plugins/architecture
- https://developer.disguise.one/plugins/configuration
- https://developer.disguise.one/plugins/distribution
- https://developer.disguise.one/plugins/useful-links

---

## Official Python API Guides

Topic-specific guides from the official Disguise developer docs. Supplement the patterns
in this file with the latest from the source:

- https://developer.disguise.one/python-api/introduction — Overview
- https://developer.disguise.one/python-api/execution-api — REST endpoint details
- https://developer.disguise.one/python-api/environment — Runtime environment & restrictions
- https://developer.disguise.one/python-api/useful-strings — Common snippets
- https://developer.disguise.one/python-api/api-changes — Changelog across Designer versions
- https://developer.disguise.one/python-api/guides/audio
- https://developer.disguise.one/python-api/guides/calibration
- https://developer.disguise.one/python-api/guides/d3net
- https://developer.disguise.one/python-api/guides/devices
- https://developer.disguise.one/python-api/guides/expressions
- https://developer.disguise.one/python-api/guides/feed
- https://developer.disguise.one/python-api/guides/resources
- https://developer.disguise.one/python-api/guides/stage
- https://developer.disguise.one/python-api/guides/track-and-sequencing
- https://developer.disguise.one/python-api/guides/transports
- https://developer.disguise.one/python-api/guides/utility
- https://developer.disguise.one/python-api/guides/video-input

---

## External Machine-Readable Resources

- OpenAPI (Service): https://developer.disguise.one/specs/service.swagger.json
- OpenAPI (Session): https://developer.disguise.one/specs/session.swagger.json
- d3.pyi (latest): https://developer.disguise.one/assets/d3.pyi
- Doc index: https://developer.disguise.one/llms.txt

---

## Knowledge Base Locations

- `packages/shared/d3.pyi` — Full API reference (~60k lines — Grep only)
- `packages/knowledge-base/patterns/*.md` — Tested working patterns
- `packages/knowledge-base/bugs/*.md` — Known crashers and workarounds
- `packages/knowledge-base/api/*.md` — Individual API endpoint test results
- `packages/knowledge-base/test-suites/*.json` — Batch test definitions
- `packages/knowledge-base/test-log.jsonl` — Append-only test result log
- `packages/knowledge-base/reference-tools/` — Local Python probes for validating KB claims
