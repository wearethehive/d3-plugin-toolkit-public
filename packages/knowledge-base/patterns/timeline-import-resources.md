---
type: pattern
status: confirmed
tested: "2026-03-25"
designer_version: "r32.3.4"
api_coverage:
  - name: "resourceManager.load"
    match: "resourceManager\\.load\\s*\\("
    related_files: ["timeline-import-resources.md"]
    required: false
---

# Timeline Import: Resource Type Loading

## Problem

When importing a timeline from JSON, resource paths like `"objects/videoclip/my_clip.apx"` must be loaded with the correct d3 type class. Loading without a type argument (or with the wrong type) causes crashes or silent failures.

## Extract Type From Path Prefix

Resource paths follow the pattern: `objects/<type>/[subfolder/]name.apx`

The `<type>` segment maps to a d3 class:

| Path prefix | d3 Class | setResource safe? | Notes |
|-------------|----------|-------------------|-------|
| `objects/videoclip/` | `d3.VideoClip` | YES | Most common layer resource |
| `objects/indirection/` | `d3.Indirection` | NO — use `insertKeyContainer` | ACCESS_VIOLATION if you use setResource |
| `objects/directprojection/` | `d3.DirectProjection` | YES | Projection mapping |
| `objects/feedprojection/` | `d3.FeedProjection` | YES | Feed/capture projection |

## Implementation

```python
import d3

TYPE_MAP = {
    "videoclip": d3.VideoClip,
    "indirection": d3.Indirection,
    "directprojection": d3.DirectProjection,
    "feedprojection": d3.FeedProjection,
}

def load_resource_from_path(res_path):
    """Load a resource with the correct type based on its path prefix."""
    rp_lower = res_path.lower()
    res_type = None

    if rp_lower.startswith("objects/"):
        parts = rp_lower.split("/")
        if len(parts) >= 3:
            res_type = TYPE_MAP.get(parts[1])

    if res_type is None:
        return None, False  # Unknown type — skip

    try:
        resource = resourceManager.load(res_path, res_type)
        is_indirection = (res_type == d3.Indirection)
        return resource, is_indirection
    except Exception:
        return None, False  # Resource not found in this project
```

## Writing Resource Keys

Different resource types require different write methods on a `ResourceSequence`:

```python
resource, is_indirection = load_resource_from_path(path)
if resource is not None:
    if is_indirection:
        # Indirection extends KeyContainer — MUST use insertKeyContainer
        seq.insertKeyContainer(beat, 0, resource)
    else:
        # VideoClip, DirectProjection, FeedProjection — setResource is safe
        seq.setResource(beat, resource)
```

### Why Indirection Is Special

- `seq.setResource(beat, indirection)` causes an ACCESS_VIOLATION at render time with the error: "Was type: Indirection but expected VideoClip::RP"
- `seq.insertKeyContainer(beat, 0, indirection)` works correctly because Indirection is a KeyContainer subclass
- This is documented in the Known Crashers table in `docs/reference.md`

## Cross-Project Import Caveat

When importing a timeline exported from **Project A** into **Project B**:

- Resources referenced by path may not exist in the target project
- `resourceManager.load(path, Type)` will throw an exception for missing resources
- The import should catch and skip these gracefully — layer structure and metadata are still recreated correctly
- Resources can be re-linked manually in the Designer GUI after import

## Always Pass the Type Argument

```python
# WRONG — returns base Resource, crashes on type-specific access
resource = resourceManager.load(path)

# CORRECT — returns properly typed resource
resource = resourceManager.load(path, d3.VideoClip)
```

This is a general rule, not specific to import. See Known Crashers in `docs/reference.md`.

## Other Resource Sequences

The TYPE_MAP above covers the resource types found on video layers. Other resource sequences (mapping, palette, output, cdl) use their own resource types, but these are less common in import scenarios and were not tested in this session. The same pattern applies: extract the type from the path prefix and pass it to `resourceManager.load()`.
