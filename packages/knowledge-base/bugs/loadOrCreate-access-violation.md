---
type: bug
status: confirmed
severity: crash
tested: "2026-03-15"
crashers:
  - pattern: "\\.loadOrCreate\\s*\\("
    condition: "Indirection|ListIndirectionController"
    message: "loadOrCreate() causes ACCESS_VIOLATION for Indirection/ListIndirectionController. Use create-or-duplicate pattern (see patterns/create-or-duplicate.md)."
    severity: crash
---

# loadOrCreate ACCESS_VIOLATION

## Description

Calling `resourceManager.loadOrCreate(path, type)` multiple times for `Indirection` or `ListIndirectionController` types in a single script execution causes an ACCESS_VIOLATION crash on the second or subsequent call.

## Reproduction

```python
import d3
rm = resourceManager

# First call succeeds
ind1 = rm.loadOrCreate('objects/indirection/test1.apx', d3.Indirection)

# Second call crashes with ACCESS_VIOLATION
ind2 = rm.loadOrCreate('objects/indirection/test2.apx', d3.Indirection)
```

## Error

```
ACCESS_VIOLATION: read at 0x120
```

Also produces IdentityDomain warning:
```
Duplicate resource adds in same transaction
```

## Workaround

Use the create-or-duplicate pattern: see `patterns/create-or-duplicate.md`.

## Affected Types

- `d3.Indirection` — CONFIRMED
- `d3.ListIndirectionController` — CONFIRMED
- `d3.VideoClip` — UNKNOWN (may also be affected)
- Other resource types — UNTESTED
