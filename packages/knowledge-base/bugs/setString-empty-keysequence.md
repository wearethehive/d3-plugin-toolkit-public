---
type: bug
status: confirmed
severity: error
tested: "2026-03-15"
crashers:
  - pattern: "setString\\s*\\(\\s*0\\s*,"
    message: "setString(0, ...) on an empty KeySequence throws IndexError. Ensure at least one key exists first (insertKeyContainer)."
    severity: error
---

# setString on Empty KeySequence

## Description

Calling `keySequence.setString(0, path)` on a KeySequence with no keys throws an IndexError.

## Error

```
IndexError: bounds-check : 0 of 0
```

## Context

After removing all keys from a sequence with `ks.remove(0, n)`, calling `setString(0, path)` fails because there is no key at index 0 to modify.

## Workaround

Either:
1. **Don't remove the first key** — keep it and overwrite:
   ```python
   n = ks.nKeys()
   if n and n > 1:
       ks.remove(1, n - 1)  # remove all except first
   ks.setString(0, ind_path)  # overwrite first key
   ```

2. **Use insertKeyContainer** to create a key first:
   ```python
   ks.insertKeyContainer(0, 0, key_container_obj)
   ```
   Note: requires a properly typed KeyContainer, not a generic Resource.
