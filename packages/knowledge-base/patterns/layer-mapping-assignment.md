---
type: pattern
status: confirmed
tested: "2026-04-04"
crashers:
  - pattern: "\\.module\\.mapping\\s*="
    message: "layer.module.mapping = proj does not persist. Use layer.findSequence('mapping').sequence.setResource(beat, proj) + field.notifyEdit(). See patterns/layer-mapping-assignment.md"
    severity: warning
api_coverage:
  - name: "layer.findSequence"
    match: "\\.findSequence\\s*\\("
    related_files: ["layer-mapping-assignment.md"]
    required: false
  - name: "layer.module.mapping"
    match: "\\.module\\.mapping"
    related_files: ["layer-mapping-assignment.md"]
    required: false
---

# Layer Mapping Assignment

## Setting a Layer's Mapping (Projection)

Use the FieldSequence pattern — find the "mapping" field, call `setResource`, then `notifyEdit`:

```python
import d3
proj = resourceManager.load(mapping_path)
map_field = layer.findSequence("mapping")
map_field.sequence.setResource(layer.tStart, proj)
map_field.notifyEdit()
```

This is the same pattern used for resource-valued layer fields such as video
and mapping assignments.

## DO NOT use `layer.module.mapping = proj`

Direct property assignment appears to work (readback shows the correct value) but **does not persist** — Designer reverts to the default mapping after save. The assignment only modifies an in-memory cache that is not serialized.

## Readback Caveat

After `setResource` on the mapping field, `layer.module.mapping.path` may still return the **old/default** mapping. This is a stale cache — the actual mapping IS correctly set. Do NOT use `layer.module.mapping` for verification after `setResource`.

To verify the mapping was set, read back via the field sequence:
```python
sv = map_field.getSequencedValue(layer.tStart)
actual_path = str(sv.resource.path) if sv and sv.resource else None
```

## Default Mapping

New layers created via `track.addNewLayer()` automatically get the **last created** DirectProjection as their default mapping. If you create screens 1, 2, 3 in order, all new layers default to screen 3's mapping.
