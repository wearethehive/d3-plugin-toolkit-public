---
type: pattern
status: needs-live-probe
scope: python-api
---

# Notch Module Enumeration and Parameter Access

**Status:** NEEDS LIVE PROBE. This entry is a candidate API note from static
inspection. Do not treat it as a confirmed Designer pattern until tested
against a real Notch block.
**Designer Version:** r32.x candidate surface observed in `d3.pyi`, not verified.

## Enumerating NotchModule Resources

`NotchModule` extends `Resource`, so `resourceManager.allResources()` appears to
accept it directly:

```python
import d3

all_notch = resourceManager.allResources(d3.NotchModule)
# Candidate return: List[NotchModule]
```

This candidate should be probed before production use. There is no confirmed
separate `notchModules` collection on Track or Layer.

## Layer and NotchModule Direction

The repo's confirmed `layer.module` guidance remains authoritative when starting
from a known layer. This candidate note must not be used to mark `layer.module`
as removed or unsafe.

When enumerating `NotchModule` resources directly, `mod.layer` is a candidate
way back to the owning layer, but this still needs a live probe:

```python
# Candidate only, not yet confirmed:
layer = mod.layer

# Confirmed elsewhere when starting from a layer:
module = layer.module
```

See `packages/knowledge-base/patterns/layer-module-access.md` and
`docs/reference.md` for the confirmed layer module access pattern.

## Listing Exposed Parameters (activeFields)

```python
mod = all_notch[0]
fields = mod.activeFields   # Candidate: List[NotchModuleConfig.Field]

for field in fields:
    name = field.name    # str, human-readable parameter name
    key  = field.key     # str, candidate sequence key used by findSequence()
    val  = field.value   # ReflectionValue, candidate read via float(field.value)
```

### NotchModuleConfig.Field properties

| Property | Type | Notes |
|----------|------|-------|
| `field.name` | str | Human-readable name shown in Notch UI |
| `field.key` | str | Key for `layer.findSequence(field.key)`, assumed to match; unverified |
| `field.value` | ReflectionValue | Live value; candidate read via `float(field.value)` for scalar params |

## ReflectionValue - Fully Opaque Type

`ReflectionValue` has no properties or methods in `d3.pyi`. The candidate read
strategy for scalar numeric parameters is:

```python
val = float(field.value)   # coerce to float
```

Non-float types (Vec, Colour, etc.) should raise `TypeError` on coercion. Guard
accordingly:

```python
try:
    val = float(field.value)
except (TypeError, ValueError):
    continue  # skip non-numeric params
```

## Bridge: activeFields to FieldSequence (Write Path)

`field.key` may map to the `findSequence()` lookup name:

```python
layer = mod.layer
fseq = layer.findSequence(field.key)

if fseq is None:
    # field.key did not match; try field.name as fallback (unverified)
    fseq = layer.findSequence(field.name)

if fseq is None:
    continue  # sequence not found; skip
```

## Writing Keyframes to Exposed Notch Parameters

Do not ship a baking loop from this note. The candidate probe should first
confirm:

- `resourceManager.allResources(d3.NotchModule)` returns live module objects.
- `mod.layer` points back to the owning layer.
- `mod.activeFields` exposes stable `name`, `key`, and `value` fields.
- `layer.findSequence(field.key)` resolves the writable `FieldSequence`.
- `float(field.value)` is safe for scalar exposed parameters.

Only after those checks pass should production code write keyframes, using the
normal `markDirty`, `disableSequencing = False`, `setFloat(beat, value)`, and
parent save pattern.

## SockPuppet Modules

`allResources(d3.NotchModule)` may return `SockPuppetNotchModule` instances.
Their `activeFields` behaviour is unverified. If baking fails on specific
modules, check `type(mod).__name__` and skip non-standard types if needed.

## Related Patterns

- `packages/knowledge-base/patterns/layer-module-access.md` - confirmed layer.module access
- `packages/knowledge-base/patterns/transport-commands.md` - TransportCommand factory methods
- `packages/knowledge-base/patterns/timeline-export-keyframe-access.md` - KeySequence read patterns
- `docs/reference.md` - KeySequence API, markDirty, known crashers
