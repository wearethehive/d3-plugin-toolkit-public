---
type: bug
status: confirmed
title: val.enabledVersion crashes natively on non-VideoClip resource types
confirmed: 2026-05-07
tested: "2026-05-07"
severity: crash
---

## Symptom

HTTP 500 with no Python log when calling `get_cuelist()` on a track that contains
non-video layers (config, audio, Notch, etc.) whose resource sequences return a
non-VideoClip `val` from `getSequencedValue()`.

## Root Cause

`val.enabledVersion` dereferences a C++ pointer that is only valid on `VideoClip`
objects. On any other resource type the pointer is null/invalid, causing a native
access violation that bypasses Python's `try/except`.

The crash was in `_get_file_info()`:
```python
sv = fseq.getSequencedValue(float(layer.tStart))
val = sv.value
v = int(val.enabledVersion)  # <-- native crash if val is not VideoClip
```

## Fix

Guard `val.enabledVersion` behind a `type(val).__name__` check. Only call it when
the native type name contains `'VideoClip'` or `'Clip'`. Non-VideoClip types return
`''` for `file_version`.

```python
file_version = ''
try:
    val_type = str(type(val).__name__)
    if 'VideoClip' in val_type or 'Clip' in val_type:
        v = int(val.enabledVersion)
        if v > 0:
            file_version = str(v)
except Exception:
    pass
```

`type(val).__name__` is safe to call because by this point `val.description` has
already been read without crashing, so `val` is a valid Python-wrapped object.

## How It Was Found

Binary search via temporary builds:
1. Skip `_layers_in_section` entirely → loads OK → crash is in layers
2. Basic loop only (no sequences, no `_get_file_info`) → loads OK → crash is in sequences or `_get_file_info`
3. Add `_get_file_info` back, no sequences → 500 → crash is in `_get_file_info`
4. Remove `val.enabledVersion` from `_get_file_info` → loads OK → confirmed crasher

## Context

`enabledVersion` was previously confirmed safe "on VideoClip objects" (probe 2026-04-19)
but was never tested on other resource types. Show tracks with mixed layer types
(config layers, Notch layers, audio layers) expose this crash.

## Related

- `bugs/layer-mapping-direct-access-crash.md` — same class of bug: C++ binding attribute
  that is only valid on a specific object type; accessing it on any other type causes a
  native crash that bypasses `try/except`.
