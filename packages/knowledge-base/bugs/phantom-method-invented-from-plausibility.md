---
type: bug
status: confirmed
severity: error
tested: "2026-04-24"
designer_version: "r32.x"
category: agent-discipline
crashers:
  - pattern: "\\.removeCueAtBeat\\s*\\("
    message: "Track has no method removeCueAtBeat. Use track.cues.removeAtTime(beat) with mergeSectionAtBeat — see patterns/cue-removal.md."
    severity: error
---

# Phantom Method: `track.removeCueAtBeat` (Agent-Invented API)

## Description

An implementation used `track.removeCueAtBeat(beat)` as the cue-clear step of a
track-wipe flow. The method does not exist on `Track`, `Layer`, or anywhere in
`packages/shared/d3.pyi`. Designer raised:

```
AttributeError: 'Track' object has no attribute 'removeCueAtBeat'
```

The name was **invented from plausibility** — the agent needed a
remove-one-cue API, pattern-matched against nearby real methods
(`mergeSectionAtBeat`, `splitSectionAtBeat`, `setNoteAtBeat`), and produced a
name that *looks* like it should exist. It does not.

## Why This Class of Mistake Matters

`check-python-safety.mjs` and `check-kb-coverage.mjs` scan for **known crasher
strings** and **known-API coverage gaps**. Neither hook catches invented names
that appear in neither list. The code passes both hooks and fails at runtime.

This is a recurring failure mode — every time it happens, it violates the
discipline rule in the Designer Python Engineer persona ("Grepping the
knowledge base is not optional — it is the first action before touching any
API not used in this session"). The fix is procedural, not code:

- Before writing any dotted method call on a Designer object, grep
  `packages/shared/d3.pyi` for the method name. If it appears nowhere,
  **do not write it**.
- Prefer a tested pattern from `knowledge-base/patterns/` over a
  first-principles guess.
- When unsure of the remove/add surface, search the class's parent classes
  too (here: `TimeSequence`, which owns `removeAtTime`).

## Wrong

```python
# Phantom — method does not exist on Track
for beat in sorted_beats:
    track.removeCueAtBeat(beat)   # AttributeError at runtime
```

## Right

Recipe from `patterns/cue-removal.md`:

```python
cue_beats = list(track.cueBeats())
for beat in sorted([float(b) for b in cue_beats], reverse=True):
    if beat <= 0:
        continue  # beat 0 is the structural root — never remove
    try:
        track.mergeSectionAtBeat(beat)
    except:
        pass
    try:
        track.cues.removeAtTime(beat)
    except:
        pass
track.save()
```

## Fix Applied

Fresh-import implementations should call a local wipe helper and cite
`patterns/cue-removal.md` in code comments so the behavior remains auditable.

## Prevention (Toolkit Candidate)

Extend `scripts/check-kb-coverage.mjs` (or add a sibling hook) to:

1. Extract every dotted method call `X.methodName(` from any Python diff.
2. Grep `packages/shared/d3.pyi` for `methodName` as a `def`/property/attribute.
3. **Hard-fail** (exit 2) on any method name with zero hits in the stub.

This would catch phantom methods before Designer ever sees them.

## Related

- `patterns/cue-removal.md` — the correct recipe
- `patterns/disguise-docs-as-source-of-truth.md` — methodology rule
- `patterns/python-attribute-assignment-is-permissive.md` — a related
  failure mode where the attribute *accepts* the write but does nothing
