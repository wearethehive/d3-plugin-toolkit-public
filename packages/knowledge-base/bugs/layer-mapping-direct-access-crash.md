---
type: bug
status: confirmed
tested: "2026-05-04"
severity: crash
---

# `layer.mapping` direct attribute access → HTTP 500 native crash

## Symptoms

HTTP 500 with no Python log when accessing `layer.mapping` as a plain
attribute. The crash occurs at the C++ engine level, bypassing all
`try/except` — even `except BaseException`.

```python
# CRASHES — do not use
m = layer.mapping
```

## Root cause

`mapping` is not a plain Python attribute on layer objects. It is a
`FieldSequence` registered internally. Accessing it as `layer.mapping`
triggers a native C++ binding path that raises an unrecoverable engine error.

## Fix

Use `findSequence('mapping')` and read the value via `getSequencedValue()`:

```python
mapping_name = ''
try:
    fseq = layer.findSequence('mapping')
    if fseq is not None:
        sv = fseq.getSequencedValue(float(layer.tStart))
        if sv is not None and sv.value is not None:
            mapping_name = str(sv.value.description)
except Exception:
    pass
```

`sv.value` is a `FeedProjection` object. Its `.description` attribute holds
the human-readable mapping name (confirmed safe). `.name` does NOT exist on
`FeedProjection` and will raise `AttributeError`.

## Discovery method

`dir(layer)` and `dir(leaf)` do not list `mapping` — it is not a Python
attribute. Found by iterating `layer.nSequences()` / `layer.sequence(i).name`
via probe, which revealed `'mapping'` as a named `FieldSequence`.

## Related

- `bugs/enabledVersion-non-videoclip-crash.md` — same class of bug: a C++ binding
  attribute (`val.enabledVersion`) that is only valid on `VideoClip` objects; accessing
  it on any other resource type causes a native crash that bypasses `try/except`.
