---
type: bug
status: confirmed
severity: crash
tested: "2026-03-15"
crashers:
  - pattern: "\\bdir\\s*\\([^)]*d3\\b"
    message: "dir() on d3 objects enumerates Action-type properties causing C++ crash. Use getattr(obj, 'attr', None) instead."
    severity: crash
---

# dir() crash on Action-type properties

## Description

Calling `dir()` on many d3 objects triggers enumeration of Action-type properties, which causes a crash at the C++ level.

## Reproduction

```python
# This will crash on many d3 object types:
dir(some_d3_object)
```

## Workaround

Avoid blanket `dir()` inspection of d3 objects. Instead, use targeted `getattr(obj, 'known_property', None)` or `hasattr()` to check for specific properties. Consult the documentation at developer.disguise.one/plugins/docs/ for available properties.
