---
type: pattern
status: confirmed
tested: "2026-05-15"
api_coverage:
  - name: "DxTexture"
    match: "\\bDxTexture\\b"
    related_files: ["media-folder-reference-scanning.md"]
    required: false
  - name: "Mesh"
    match: "\\bd3\\.Mesh\\b"
    related_files: ["media-folder-reference-scanning.md"]
    required: false
---

# Media Folder Reference Scanning

How to determine which files in `objects/VideoFile/`, `objects/dxtexture/`, and
`objects/mesh/` are actually in use across all Designer contexts.

## Folder → Resource Type → Reference Sources

| Folder | Resource type | Timeline seq | Stage/object sources |
|---|---|---|---|
| `objects/VideoFile/` | `VideoFile`, `VideoClip` | `findSequence('video')` | none |
| `objects/dxtexture/` | `DxTexture` | `findSequence('bitmap')` | `Prop.renderSettings.diffuseMap`, `Display.pixel_mask`, `Display.population_mask`, `Screen2.colourMap` |
| `objects/mesh/` | `Mesh` | none | `Object.mesh` |

## Critical Gotcha: Description Version Behaviour Differs by Type

**VideoFile/VideoClip**: `.description` is **version-stripped**.  
`clip_v003.mov` on disk → description = `clip.mov`.  
When matching disk filenames to timeline refs, compare the **version-stripped base** of the disk filename against the description.

**DxTexture**: `.description` **includes the version suffix**.  
`cloud_sl_v002.png` on disk → description = `cloud_sl_v002` (no extension).  
When matching, add both the full normalized description AND the version-stripped base
(extracted from `.path`, which always has the extension) to your ref set.

```python
def _add_ref(refs_norm, path_or_desc):
    """Add normalized name + version-stripped base to a ref set."""
    if not path_or_desc:
        return
    refs_norm.add(_normalize(path_or_desc))
    slash = max(path_or_desc.rfind('/'), path_or_desc.rfind('\\'))
    basename = path_or_desc[slash + 1:] if slash >= 0 else path_or_desc
    base_key, _ = _parse_version(basename)   # needs extension to match
    if base_key is not None:
        refs_norm.add(_normalize(base_key))
```

Always call `_add_ref` with **both** `r.description` and `r.path` so the
version-stripping can operate on the path's extension when the description has none.

## DxTexture: Filter User Files from Internal/Procedural Resources

`allResources(DxTexture)` returns 500+ resources including procedural textures
(empty path) and internal thumbnails (`internal/thumbnails/...`). Filter to user
files by checking the path prefix:

```python
all_tex = resourceManager.allResources(d3.DxTexture)
for i in range(len(all_tex)):
    t = all_tex[i]
    p = str(t.path)
    if p.startswith('objects/dxtexture/'):
        # user file — safe to match against disk files
```

## Bitmap Layer Texture References

The timeline sequence name for bitmap layers is `'bitmap'` (not `'texture'`).
`key.r` is a `DxTexture` resource when assigned.

```python
fseq = leaf.findSequence('bitmap')
if fseq is not None:
    seq = fseq.sequence
    for ki in range(seq.nKeys()):
        key = seq.key(ki)
        if str(type(key).__name__) == 'KeyResource' and key.r is not None:
            _add_ref(refs_norm, str(key.r.description))
            _add_ref(refs_norm, str(key.r.path))
```

## Prop Diffuse Map (Nested Access)

The diffuse map on a `Prop` is **not** a direct attribute — it lives under
`renderSettings`:

```python
props = resourceManager.allResources(d3.Prop)
for i in range(len(props)):
    prop = props[i]
    try:
        tex = prop.renderSettings.diffuseMap
        if str(tex.path).startswith('objects/dxtexture/'):
            _add_ref(refs_norm, str(tex.description))
            _add_ref(refs_norm, str(tex.path))
    except:
        pass
```

`prop.diffuseMap` does not exist — the attribute raises immediately. Only
`prop.renderSettings.diffuseMap` works.

## Display Mask References

`Display` (LED panels) exposes two DxTexture mask slots directly:

```python
displays = resourceManager.allResources(d3.Display)
for i in range(len(displays)):
    d = displays[i]
    for attr in ['pixel_mask', 'population_mask']:
        try:
            tex = getattr(d, attr)
            if str(tex.path).startswith('objects/dxtexture/'):
                _add_ref(refs_norm, str(tex.path))
        except:
            pass
```

## Screen2 (Surface) Colour Map

`Screen2` (username: "Surface") has `colourMap` labelled "Diffuse map" in the UI:

```python
surfaces = resourceManager.allResources(d3.Screen2)
for i in range(len(surfaces)):
    try:
        tex = surfaces[i].colourMap
        if str(tex.path).startswith('objects/dxtexture/'):
            _add_ref(refs_norm, str(tex.path))
    except:
        pass
```

## Mesh References via Object

Meshes in `objects/mesh/` are assigned to `Object` resources (stage objects),
not to timeline layers. Scan via `.mesh.path`:

```python
objects = resourceManager.allResources(d3.Object)
for i in range(len(objects)):
    try:
        m = objects[i].mesh
        if str(m.path).startswith('objects/mesh/'):
            _add_ref(refs_norm, str(m.description))
            _add_ref(refs_norm, str(m.path))
    except:
        pass
```

## Known Sandbox Blind Spots

- **FeedScene**: texture attributes (set extension masks, warp maps) are not
  accessible from plugin Python. Files only used in FeedScene will appear as
  unused even when active.
- **MappedMediaDomain.findResourceUsage**: sandboxed out for DxTexture and Mesh;
  only works (partially) for VideoClip and is blocked for the others.

