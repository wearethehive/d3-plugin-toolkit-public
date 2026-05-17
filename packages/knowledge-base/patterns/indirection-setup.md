---
type: pattern
status: confirmed
tested: "2026-03-17"
api_coverage:
  - name: "insertKeyContainer"
    match: "\\.insertKeyContainer\\s*\\("
    related_files: ["indirection-setup.md"]
    required: false
---

# Indirection Setup Pattern

## Full Chain (CONFIRMED WORKING 2026-03-18 — media picker visible immediately)

1. Create Indirection: `resourceManager.loadOrCreate("objects/indirection/{name}.apx", d3.Indirection)`
2. **Set expectedType:** `ind.expectedType = VideoClip` — CRITICAL for media picker visibility
3. Create Controller at **type-specific path**: `resourceManager.loadOrCreate("objects/listindirectioncontroller/{name}.apx", d3.ListIndirectionController)`
4. Associate: `ind.controller = ctrl`
5. Load media with typed load: `resourceManager.load(path, VideoClip)` — second arg returns properly typed resource
6. Add media: `ctrl.resources = [clip1, clip2]` (list assignment, NOT `.append()` which crashes. MUST be VideoClip, NOT VideoFile)
7. Set OSC: `ctrl.selectedIndexExpressionText = "osc:test.selector"` (dot notation, not slashes)
8. Notify & save: `ind.notifyCreate()`, `ind.activate()`, `ind.save()` (same for ctrl)
9. Bind to layer: clear keys then `insertKeyContainer` (see below)

### Step 6 — Binding to Layer (CONFIRMED WORKING)

```python
# Option A: via layer.fields iteration
fields = getattr(layer, 'fields', None) or []
video_field = None
for fs in fields:
    try:
        uname = str(getattr(fs, 'userName', ''))
        name = str(getattr(fs, 'name', ''))
        if uname == 'Video' or name.lower() == 'video':
            video_field = fs
            break
    except Exception:
        pass

# Option B: via findSequence (also works)
# video_field = layer.findSequence("video")

ks = video_field.sequence
n = ks.nKeys()
if n and n > 0:
    ks.remove(0, n)  # MUST clear existing keys first
ks.insertKeyContainer(0.0, 0, ind)  # second arg is interpolation type (0 = select)
```

**DO NOT USE** these alternatives — all crash:
- `seq.setResource(0, ind)` — ACCESS_VIOLATION at render time ("Was type: Indirection but expected VideoClip::RP")
- `seq.setString(0, ind_path)` — HTTP 500 crash
- Source: https://developer.disguise.one/plugins/guides/track-and-sequencing

### Save Methods

- `resource.save()` — saves immediately to disk
- `resource.saveOnDelete()` — defers save to garbage collection / batch save
- `resourceManager.saveAll()` — flushes all pending deferred saves
- `resource.notifyCreate()` — should be called on newly created resources (may help UI visibility)
- `resource.activate()` — performs resource initialization

### Controller Path

Use **type-specific** controller paths matching the GUI convention:
- `objects/listindirectioncontroller/` for ListIndirectionController
- `objects/oscindirectioncontroller/` for OscIndirectionController
- `objects/keyedlistindirectioncontroller/` for KeyedListIndirectionController
- `objects/manualindirectioncontroller/` for ManualIndirectionController
- `objects/sequencedindirectioncontroller/` for SequencedIndirectionController

Using the generic `objects/indirectioncontroller/` path causes status access violations at runtime.
Both paths produce functional resources after restart, but the type-specific path avoids runtime errors.

## Media Picker Visibility — SOLVED (2026-03-18)

**The fix:** Set `ind.expectedType = VideoClip` on the Indirection after creation.
Without this, indirections are invisible in the media picker until restart.
With it, they appear immediately — no restart needed.

Also required for full functionality:
- Use type-specific controller path (`objects/listindirectioncontroller/` not `objects/indirectioncontroller/`)
- Use typed `resourceManager.load(path, VideoClip)` for media loading
- Call `notifyCreate()`, `activate()`, `save()` on both indirection and controller

**DO NOT use `reloadExternal()`** — causes ACCESS_VIOLATION.

## Reading Back

**WARNING:** Reading keyframe resources via the Python API currently crashes.
`seq.key(0)` returns `KeyAsKeyContainer` — ALL property access on it causes HTTP 500 native crash.

```python
# These all CRASH — do NOT use:
# key.r, key.resource, key.controller, key.description, key.t
```

The export function works around this by reading from the Indirection/Controller resources directly
(loaded by path) rather than traversing from the keyframe.

## Key Properties on ListIndirectionController

- `resources` (Array<Resource::RP>) — media file list, supports append/erase and direct assignment
- `selectedIndex` (int) — current active index
- `selectedIndexExpressionText` (str) — expression driving index, default "self"
- `description`, `path`, `uid` — standard resource properties

## Controller Types and Useful Fields

When building inspection or repair tools, filter out trashed controllers with
both `getattr(c, "inTrash", False)` and `str(c.path).startswith("trash/")`.

| Controller | Useful fields |
|---|---|
| `ListIndirectionController` | `resources`, `selectedIndex`, `selectedIndexExpressionText` |
| `ManualIndirectionController` | `selection` |
| `SequencedIndirectionController` | `selection` |
| `MachineListIndirectionController` | `default` |
| `KeyedListIndirectionController` | `resources` entries with `key` and `resource`, plus `matchMode` |
| `OscIndirectionController` | `address`, `device` |

For list-like controller resources, mutate by copying to a native list,
modifying the list, then assigning the whole property back. This applies to
adding/removing resources and keyed resource entries.

Selection rules:

- `ListIndirectionController` selects by `selectedIndex`.
- `ManualIndirectionController` and `SequencedIndirectionController` select by
  assigning a loaded resource to `selection`.
- `KeyedListIndirectionController.matchMode` uses `0` for exact matching and
  `1` for contains matching.

## Important

- Controller path: use type-specific path (e.g. `objects/listindirectioncontroller/` NOT generic `objects/indirectioncontroller/`)
- All paths lowercase
- `resource.save()` for immediate persistence; `markDirty()` + `saveOnDelete()` for deferred
- Layer video field name is `"video"` (found via `layer.findSequence("video")` or fields iteration)
- Indirection IS a KeyContainer — both Resource and Indirection are KeyContainer subtypes
- `insertKeyContainer` second param is interpolation type (`d3.Key.select` = 0), NOT an index
- MUST `remove(0, n)` existing keys before inserting — otherwise binding may not take effect
- Do NOT use `os.makedirs()` in the project folder mid-session — can crash Designer
