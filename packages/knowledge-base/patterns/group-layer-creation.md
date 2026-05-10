---
type: pattern
status: confirmed
tested: "2026-03-25"
designer_version: "r32.3.4"
api_coverage:
  - name: "track.groupLayers"
    match: "\\.groupLayers\\s*\\("
    related_files: ["group-layer-creation.md"]
    required: false
---

# GroupLayer Creation via track.groupLayers()

## The Correct Method

Use `track.groupLayers(layers_list, name, smart)` to create groups. This is the **only** working method.

```python
import d3

track = guisystem.track

# Create child layers first
layer_a = track.addNewLayer(d3.VariableVideoModule, 0.0, 15.0, "Layer A")
layer_b = track.addNewLayer(d3.VariableVideoModule, 0.0, 15.0, "Layer B")
layer_c = track.addNewLayer(d3.VariableVideoModule, 0.0, 15.0, "Layer C")

# Create regular group
track.groupLayers([layer_a, layer_b, layer_c], "My Group", False)
track.saveOnDelete()

# Create smart group (pass True as third arg)
track.groupLayers([layer_a, layer_b], "Smart Group", True)
track.saveOnDelete()
```

### Parameters
| Arg | Type | Description |
|-----|------|-------------|
| `layers_list` | list of Layer | Child layers to group (must already exist on the track) |
| `name` | str | Display name for the group |
| `smart` | bool | `False` = GroupLayer, `True` = SmartGroupLayer |

## The Constructor Does NOT Work

```python
# DO NOT USE — Python 2 binding bug
d3.GroupLayer([layer_a, layer_b])  # Fails silently or crashes
```

The `d3.GroupLayer()` constructor has a Python 2 binding bug and cannot be used to create groups programmatically. Always use `track.groupLayers()`.

## Dissolving a Group

```python
track.ungroupLayer(group)
track.saveOnDelete()
```

This dissolves the group — child layers are released back to the track as independent layers. The group wrapper is removed.

**WARNING:** `track.removeLayer(group)` removes the group AND all its children. Use `ungroupLayer` to dissolve without deleting children.

## Reading Group Properties

```python
group.name          # str — group display name (read/write)
group.layers        # list — child layers
group.nLayers()     # int — child count
group.expanded      # bool — read/write, whether group is expanded in UI
group.getAllLayers() # list — recursive child enumeration (includes nested group children)
```

## Identifying Groups

```python
import d3

layer = track.layers[i]
is_group = isinstance(layer, d3.GroupLayer)
layer_type = str(type(layer).__name__)  # "GroupLayer" or "SmartGroupLayer"
```

GroupLayers have no `.module` attribute (unlike VariableVideoModule layers). Check `hasattr(layer, 'module')` to differentiate.

## Import Pattern: Recreating Groups After Children

When importing a timeline from JSON, groups must be recreated **after** all child layers exist:

1. Create all non-group layers in reverse index order (addNewLayer stacks on top)
2. Build a map: `layer_name -> created_layer_object`
3. For each group in the export data, collect its member layer objects by name
4. Call `track.groupLayers(members, group_name, is_smart)` for each group

```python
# After all children are created:
created_by_name = {"Layer A": layer_a_obj, "Layer B": layer_b_obj}

# From export JSON: group_name -> [child_name, ...]
for gname, child_names in group_children.items():
    members = [created_by_name[cn] for cn in child_names if cn in created_by_name]
    if members:
        track.groupLayers(members, gname, is_smart)
```

## Key Observations

- Groups contain layers by reference — the child layers must exist on the track before grouping
- `track.groupLayers` returns void (not the new group object). Find the group afterward via `track.layers` iteration
- SmartGroupLayer is a subclass of GroupLayer; both support `.layers`, `.nLayers()`, `.expanded`
- Probe confirmed: regular group had type `GroupLayer`, smart group had type `SmartGroupLayer`
