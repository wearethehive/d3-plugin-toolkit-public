---
type: pattern
status: observed
tested: "2026-05-03"
api_coverage:
  - name: "layer.fields"
    match: "\\.fields"
    related_files: ["layer-field-discovery-and-update.md", "timeline-export-keyframe-access.md"]
    required: false
  - name: "FieldSequence.notifyEdit"
    match: "\\.notifyEdit\\s*\\("
    related_files: ["layer-field-discovery-and-update.md", "layer-mapping-assignment.md"]
    required: false
---

# Layer Field Discovery and Key Updates

## Purpose

Layer-editing UIs can discover editable fields by inspecting `layer.fields`,
then infer the write path from the first key class. This avoids hard-coding every
module-specific field name.

## List Leaf Layers for UI Selection

When a UI needs editable layers, expand group containers and use leaf layers for
editing. `isinstance(layer, GroupLayer)` is a better group test than checking for
`getLeafLayers`, because many layer surfaces expose traversal helpers.

```python
def expand_layers(layers, seen=None):
    if seen is None:
        seen = set()
    result = []

    try:
        count = int(len(layers))
    except:
        count = 0

    for index in range(count):
        try:
            layer = layers[index]
        except:
            continue

        obj_id = id(layer)
        if obj_id in seen:
            continue
        seen.add(obj_id)

        try:
            is_group = isinstance(layer, GroupLayer)
        except:
            is_group = False

        if is_group:
            expanded = False
            for fn_name in ("getLeafLayers", "getAllLayers"):
                try:
                    fn = getattr(layer, fn_name, None)
                    if callable(fn):
                        children = fn()
                        if children:
                            result.extend(expand_layers(children, seen))
                            expanded = True
                            break
                except:
                    pass
            if not expanded:
                result.append(layer)
        else:
            result.append(layer)

    return result
```

Filter to layers active at the current playhead by comparing track beats:

```python
playhead = float(guisystem.player.tCurrent)
active = []
for layer in expand_layers(guisystem.track.layers):
    try:
        t_start = float(layer.tStart)
        t_end = t_start + float(layer.tLength)
        if t_start <= playhead < t_end:
            active.append(layer)
    except:
        active.append(layer)  # fail open for UI discovery
```

For Live Update object paths, prefer UID-based lookup because it survives
renames:

```python
uid_text = str(getattr(layer, "uid", "") or "").strip()
live_object_path = None
if uid_text:
    try:
        uid_literal = "0x{0:x}".format(int(uid_text.rstrip("Ll"), 0))
    except:
        uid_literal = uid_text
    live_object_path = "getByUID(" + uid_literal + ")"
```

## Discover Field Value Types

For UI listing, read field values at each key time through
`field.getSequencedValue(time).value` rather than assuming the raw key object has
the user-facing value. Resource values expose a `.path`; enum-style fields often
store a float index and expose labels through `field.options()`.

```python
def key_attr_for_field(field_seq):
    try:
        seq = field_seq.sequence
        if seq is None or int(seq.nKeys()) <= 0:
            return "v"
        first_key = seq.key(0)
        key_class = type(first_key).__name__.lower()
    except:
        return "v"

    if "colour" in key_class or "color" in key_class:
        return "c"
    if "resource" in key_class:
        return "r"
    if "string" in key_class or "str" in key_class:
        return "s"
    if "int" in key_class:
        return "i"
    return "v"

def discover_fields(layer):
    result = []
    try:
        fields = layer.fields or []
    except:
        fields = []

    try:
        field_count = int(len(fields))
    except:
        field_count = 0

    for index in range(field_count):
        try:
            field = fields[index]
            name = str(field.name or "").strip()
            if not name:
                continue
            result.append({
                "name": name,
                "userName": str(getattr(field, "userName", "") or name),
                "typeName": str(getattr(field, "typeName", "") or ""),
                "keyAttr": key_attr_for_field(field),
                "isPatched": bool(getattr(field, "isPatched", False)),
                "isKeyframed": int(field.sequence.nKeys()) > 1 if field.sequence else False,
            })
        except:
            pass
    return result
```

## Update Existing or New Key

```python
def find_key_at_time(keyseq, track_time):
    try:
        count = int(keyseq.nKeys())
    except:
        count = 0
    for index in range(count):
        try:
            if abs(float(keyseq.t(index)) - float(track_time)) <= 0.0001:
                return keyseq.key(index)
        except:
            pass
    return None

def insert_key_at_time(keyseq, track_time):
    try:
        count = int(keyseq.nKeys())
    except:
        count = 0
    insert_index = count
    for index in range(count):
        try:
            if float(keyseq.t(index)) > float(track_time):
                insert_index = index
                break
        except:
            pass
    keyseq.insert(insert_index, float(track_time), 0)
    return keyseq.key(insert_index)

def ensure_key_at_time(keyseq, track_time):
    key = find_key_at_time(keyseq, track_time)
    if key is not None:
        return key
    return insert_key_at_time(keyseq, track_time)
```

## Choosing the Write Beat

```python
def resolve_keyframe_beat(layer, field, explicit_time):
    if explicit_time is not None:
        return float(explicit_time)

    try:
        key_count = int(field.sequence.nKeys()) if field.sequence else 0
    except:
        key_count = 0

    if key_count > 1:
        try:
            field.disableSequencing = False
        except:
            pass
        try:
            return float(guisystem.player.tCurrent)
        except:
            pass

    if key_count == 1:
        try:
            return float(field.sequence.t(0))
        except:
            pass

    try:
        return float(layer.tStart)
    except:
        return 0.0
```

## Write Paths

```python
field = layer.findSequence(attr_name)
track_time = resolve_keyframe_beat(layer, field, explicit_time)
seq = field.sequence
sample = seq.key(0) if seq.nKeys() > 0 else None

if sample is not None and hasattr(sample, "r"):
    seq.setResource(track_time, resource_value)
elif sample is not None and hasattr(sample, "s"):
    seq.setStringAtT(track_time, str(new_value))
elif sample is not None and hasattr(sample, "i"):
    ensure_key_at_time(seq, track_time).i = int(new_value)
elif sample is not None and hasattr(sample, "c"):
    ensure_key_at_time(seq, track_time).c = Colour(r, g, b)
else:
    seq.setFloat(track_time, float(new_value))

field.notifyEdit()
```

## Important Details

- A single-key field is usually static. Updating the existing key time avoids
  accidentally inserting an extra key at `layer.tStart`.
- For multi-key fields, set `field.disableSequencing = False` before writing at
  the playhead.
- When `field.options()` is non-empty, numeric sequence values may be enum
  indexes. Convert only after checking that the index is valid for the options
  list.
- Expand group layers with `getLeafLayers()` before presenting editable layer
  rows. Editing the group container itself usually misses the module fields.
- Use `field.notifyEdit()` after direct key mutation (`.i`, `.c`, etc.).
- The recipe uses the repo's safer index-iteration style for d3 collections.
