---
type: pattern
status: confirmed
tested: "2026-09-22"
designer_version: "r34.0.3"
api_coverage:
  - name: "track.addNewLayer(d3.OscControlModule, ...)"
    match: "addNewLayer\\s*\\(\\s*d3\\.OscControlModule"
    related_files: ["osc-control-module-keyframing.md", "group-layer-creation.md"]
    required: false
  - name: "OscControlModule variable sequences"
    match: "findSequence\\s*\\(\\s*['\\\"]variable_[1-4]['\\\"]"
    related_files: ["osc-control-module-keyframing.md"]
    required: false
---

# OSC Control Module Keyframing and Command Persistence

## Confirmed Surface

`d3.OscControlModule` exposes four float variables, `variable_1` through
`variable_4`. A layer can be created and its variable sequences can be written
as normal Designer keyframes:

```python
layer = track.addNewLayer(
    d3.OscControlModule,
    start_beat,
    duration_beats,
    "OSC automation",
)
field = layer.findSequence("variable_1")
field.disableSequencing = False
sequence = field.sequence
sequence.setFloat(start_beat, 0.0)
sequence.setFloat(start_beat + duration_beats, 1.0)
field.notifyEdit()
```

Use absolute track beats. `setFloat()` overwrites an existing key at the exact
same beat. When a re-export changes the beat set, clear the previous keys first:

```python
key_count = int(sequence.nKeys())
if key_count:
    sequence.remove(0, key_count)
```

New float keys default to cubic interpolation. A newly created layer also has a
default key at its start beat.

## Command Wiring Limitation

A fresh OSC Control layer has `module.command is None`. Constructing a new
`d3.OscCommand()` and assigning it to `module.command` appears to work inside
the same Python execution, but the link did not survive a separate execution or
appear in Designer's Command browser. Explicit resource saves and the unnamed
resource save lifecycle did not make the first link persist.

There is therefore no confirmed Python method for creating the layer's first
persistent command link. Create that command once through Designer's UI.

After a command is already linked, editing its fields is confirmed to persist:

```python
module = layer.module
command = module.command
if command is None:
    raise RuntimeError("Create the OSC command in Designer first")

command.address = "/example/address"
module.osc_device = existing_osc_device
module.auto_resend = 1
command.save()
```

Do not claim end-to-end OSC delivery from structural readback alone. Verify
actual transmission with an external OSC receiver.

## Layer Identity

Timeline layers are embedded resources and commonly have an empty `path`. Use
`layer.uid` for later lookup and iterate proxy collections by index:

```python
layers = track.layers
for i in range(len(layers)):
    candidate = layers[i]
    if str(candidate.uid) == wanted_uid:
        layer = candidate
        break
```

## Related

- `patterns/group-layer-creation.md`
- `patterns/layer-field-discovery-and-update.md`
- `patterns/timeline-export-keyframe-access.md`
- `bugs/addLayer-crash.md`
