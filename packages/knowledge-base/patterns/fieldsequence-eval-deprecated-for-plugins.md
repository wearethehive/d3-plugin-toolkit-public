---
type: pattern
status: confirmed
tested: "2026-08-17"
designer_version: "r34.0.3"
---

# `FieldSequence.eval()` Is Deprecated For Plugin Use

## Observation

Calling `FieldSequence.eval(t, ttl)` from plugin Python logs a deprecation
warning to Designer's console, even on a successful call:

```
!!!!! Deprecated member eval called
FieldSequence.eval() will be restricted from plugins in a future Designer
release. Please update your plugins to switch to FieldSequence.getSequencedValue().
```

## Implication

Do not build new plugin code around `FieldSequence.eval()` — Designer
itself is telling plugins to migrate off it, and it may be blocked entirely
in a future release. Use `getSequencedValue(t)` instead.

Note: `getSequencedValue()`'s own docstring in `d3.pyi` says "If the
FieldSequence is expression or sockpuppet-controlled, this does not
represent the external control value, only sequencing" — which reads as a
contradiction to Designer recommending it as the `.eval()` replacement.

Tested live 2026-08-17 against a Notch layer field externally bound via a
MIDI-driven `ExpressionVariablesDevice` function (`disableSequencing: true`,
`isPatched: false`): `.expression` was `None` and `getSequencedValue()`
returned a static default, not the live externally-driven value. So the
docstring caveat holds, at least for this externally-bound-field case —
`getSequencedValue()` is not a working replacement for reading a live
externally-driven value, whatever Designer's own migration message implies.
See `expression-feedback-read-via-evaluatefromstring.md` for the read path
that does work.

## Related

- `bugs/fieldsequence-standalone-construction-uninitialized-crash.md`
- `expression-api.md`

