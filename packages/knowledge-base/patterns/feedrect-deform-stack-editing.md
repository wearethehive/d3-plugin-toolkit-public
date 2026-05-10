---
type: pattern
status: observed
tested: "2026-04-11"
api_coverage:
  - name: "DeformStack"
    match: "\\.deformStack|\\.getControlPoint\\s*\\(|\\.setControlPoint\\s*\\(|\\.manipulationTechnique"
    related_files: ["feedrect-deform-stack-editing.md"]
    required: false
  - name: "d3.Vec for patch control points"
    match: "d3\\.Vec\\s*\\("
    related_files: ["feedrect-deform-stack-editing.md"]
    required: false
---

# FeedRect Deform Stack Editing

## Purpose

Inspect and edit output-warp deform items attached to a `FeedRect`.

This fills a gap between the broader feed-scene setup docs and the lower-level
patch/control-point APIs exposed in `d3.pyi`.

## Locate Deform Items

```python
import d3

machines = resourceManager.allResources(d3.Machine)
for machine_index in range(len(machines)):
    machine = machines[machine_index]
    if not machine.feed:
        continue

    rects = machine.feed.feedRects
    for rect_index in range(len(rects)):
        rect = rects[rect_index]
        stack = rect.deformStack

        for item_index in range(stack.size()):
            item = stack.item(item_index)
            group = getattr(item, "group", None)
            info = {
                "name": str(item.userName),
                "type": str(type(item).__username__),
                "enabled": bool(item.enabled),
                "technique": str(getattr(item, "manipulationTechnique", "")),
                "hasPatchGroup": group is not None,
            }
```

## Toggle an Item

Mark the item dirty before changing `enabled`, then save the parent feed.

```python
before = bool(item.enabled)
markDirty(item)
item.enabled = not before
markDirty(machine.feed)
machine.feed.save()
```

Both `saveOnDelete()` and an explicit `markDirty(feed)` plus `feed.save()` have
worked in probes. Prefer the explicit dirty/save sequence when implementing
plugin behavior.

## Read Patch Control Points

Only call `group.patch(x, y)` within confirmed bounds. Probing beyond reported
bounds can crash on narrow groups.

```python
group = getattr(item, "group", None)
if group is not None:
    width = int(group.width())
    height = int(group.height())

    for patch_x in range(width):
        for patch_y in range(height):
            patch = group.patch(patch_x, patch_y)
            cp = patch.getControlPoint(0, 0)
            point = [float(cp.x), float(cp.y), float(cp.z)]
```

## Write One Control Point

Use `d3.Vec`, mark the deform item dirty, and save the parent feed. Probes
should restore the original value immediately.

```python
patch = group.patch(0, 0)
original = patch.getControlPoint(0, 0)

markDirty(item)
patch.setControlPoint(0, 0, d3.Vec(0.05, 0.05, 0.0))
markDirty(machine.feed)
machine.feed.save()

# Probe cleanup
markDirty(item)
patch.setControlPoint(0, 0, original)
markDirty(machine.feed)
machine.feed.save()
```

## Safety Notes

- Use index-based iteration for machines, feed rects, and deform-stack entries.
- Avoid `dir()` on live d3 objects. Older exploratory `*_dir.py` probes predate
  the current `dir-crash` discipline.
- Do not infer patch dimensions by walking out of bounds in production code.
  Bounds probing belongs only in isolated reference probes.
