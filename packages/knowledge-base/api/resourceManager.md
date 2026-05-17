---
type: api
status: works
tested: "2026-03-15"
api_coverage:
  - name: "resourceManager.allResources"
    match: "resourceManager\\.allResources"
    related_files: []
    required: false
---

# resourceManager

## Access

`resourceManager` is a pre-injected global in the Python execution environment.

**DO NOT** use `d3.ResourceManager.get()` — it causes HTTP 500.

## Methods

### loadOrCreate(path, type)

**Status**: WORKS_WITH_CAVEATS

Creates or loads a resource at the given path.

```python
import d3
rm = resourceManager
ind = rm.loadOrCreate('objects/indirection/my_ind.apx', d3.Indirection)
```

**Known Issues**:
- Calling `loadOrCreate` multiple times for `Indirection` or `ListIndirectionController` types in the same script triggers ACCESS_VIOLATION crash after the first create.
- Returns `Resource` wrapper type, not the specific subclass (e.g., returns `Resource`, not `Indirection`).
- All paths MUST be lowercase.

**Workaround**: See `patterns/create-or-duplicate.md`.

### load(path)

**Status**: WORKS

Loads an existing resource. Returns `None` if not found.

```python
res = rm.load('objects/indirection/my_ind.apx')
```

### allResources(type)

**Status**: WORKS

Returns all resources of a given type. Type must come from `import d3`, not the global `d3` object.

```python
import d3
videos = rm.allResources(d3.VideoFile)
for i in range(len(videos)):
    v = videos[i]
```

**Note**: Collections are NOT iterable with `for x in collection`. Use index-based access.

### exists(path)

**Status**: UNTESTED

### deleteResource(resource)

**Status**: UNTESTED

## Important

- The global `d3` object does NOT expose types like `VideoFile`, `Indirection`, etc.
- Types must be accessed via `import d3` at the top of the script.
- All resource paths must be lowercase.
