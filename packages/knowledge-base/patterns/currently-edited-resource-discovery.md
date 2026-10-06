---
type: pattern
status: confirmed
tested: "2026-10-06"
scope: registered-python-module
api_coverage:
  - name: "Resource.isBeingEdited"
    match: "\\.isBeingEdited"
    related_files: ["currently-edited-resource-discovery.md"]
    required: false
  - name: "Module.layer"
    match: "\\.layer"
    related_files: ["currently-edited-resource-discovery.md"]
    required: false
---

# Discover Resources Currently Being Edited

## Purpose

Offer a local plugin a small candidate set based on what the user has open in
Designer, instead of listing every resource in the project.

`Resource.isBeingEdited` is documented by the official Python API as indicating
whether a resource is currently being edited. Scan the base `Resource` type and
return JSON-safe rows:

```python
import d3

resources = resourceManager.allResources(d3.Resource)
rows = []
for index in range(len(resources)):
    try:
        resource = resources[index]
        if not bool(resource.isBeingEdited):
            continue
        path = str(resource.path)
        if path.lower() == "internal/d3state/d3.apx":
            continue
        rows.append({
            "name": str(resource.description),
            "path": path,
            "uid": str(resource.uid),
        })
    except:
        pass
```

## Important baseline

With Designer’s dashboard open, `internal/d3state/d3.apx` reports
`isBeingEdited == True`. Filter that internal state resource or every selection
picker will claim that “d3” is selected.

More than one resource may be edited at once, so callers should present the
remaining candidates rather than guessing which editor is foremost. Store the
UID as the durable monitoring key; unnamed resources may have an empty path.

## Collapse nested module/layer duplicates

Opening a timeline layer editor can mark both the parent `Layer` and its child
`Module` as being edited. On r34.0.3, an open Video layer returned:

- `VideoModule`, UID `0`, empty path
- `Layer`, a persistent non-zero UID, empty path

The documented `Module.layer` property on that edited `VideoModule` returned
the exact edited `Layer`. A user-facing layer picker should therefore suppress
the module row when its parent layer is already in the edited set. Keep the
`Layer` row for timeline operations such as right-click-equivalent locking. Do
not treat UID `0` on the child module as a durable selection key.

## Evidence

`reference-tools/probe_currently_edited_resources.py` ran as a registered
module on r33.0.2. It
scanned 2,616 resources in 8.38 ms and returned only the internal D3State in the
dashboard-only baseline. The official property semantics support the filtered
candidate approach.

On r34.0.3.258249, the registered lock round-trip probe found exactly one
currently edited non-D3State resource: an unnamed Video layer. Its UID was a
usable mutation key even though its path was empty. This confirms the intended
selection flow for timeline layers.

`reference-tools/probe_edited_layer_module_pairs.py` then confirmed that the
apparent second Video entry was the layer's edited `VideoModule` child, and
that `VideoModule.layer` resolved to the same edited Layer UID.
