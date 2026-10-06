---
type: bug
status: confirmed
tested: "2026-08-17"
designer_version: "r34.0.3"
severity: crash
---

# Standalone `FieldSequence()` Construction Is Uninitialized — Crashes on `.eval()`

## Symptom

Constructing a `FieldSequence` directly via `d3.FieldSequence()` (not obtained
from an existing layer's `findSequence()`) appears to succeed at the Python
level — `type(fs).__name__` is `'FieldSequence'`, no exception on
construction. But the underlying native sequence is uninitialized. Designer's
log shows `!!!!! null sequence` immediately on construction.

Calling `.eval(t, ttl)` on this uninitialized sequence causes a native fault:

```
RuntimeError: Exception: ACCESS_VIOLATION: read at 0x0
```

`.getSequencedValue(t)` fails more gracefully with a catchable RuntimeError:

```
RuntimeError: FieldSequence::getValue called on uninitialized sequence
```

## Root cause

`FieldSequence` is a `Resource` subclass and is technically constructible,
but it is designed to be created and owned internally by a Layer's module —
there is no supported standalone/detached use. The constructor does not run
the setup that a layer-owned sequence gets (`FieldSequence::setup` /
`Resource::safeActivate`), leaving raw/null internal state.

## Minimal reproduction

```python
import d3
fs = d3.FieldSequence()      # "succeeds" — null sequence, logged by Designer
fs.setExpression('cambright()')  # succeeds — just stores the expression string
fs.eval(0.0, 0)               # ACCESS_VIOLATION: read at 0x0
```

## Workaround

Never construct `FieldSequence()` standalone. Only use `FieldSequence`
objects obtained from an existing layer via `layer.findSequence(name)`,
which are already properly initialized.

## Related

- `.eval()` is separately deprecated for plugin use — see
  `patterns/fieldsequence-eval-deprecated-for-plugins.md`.
- `expression-api.md` — the only currently-confirmed way to drive/read a
  FieldSequence value is through a layer-owned sequence.

