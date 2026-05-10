---
type: pattern
status: confirmed
tested: "2026-04-04"
crashers:
  - pattern: "\\bexcept\\s+Exception\\b"
    condition: "\\bimport\\s+d3\\b"
    message: "except Exception does NOT catch all d3 errors. Some d3 attribute errors bypass Exception. Use bare except: for d3 API calls. See patterns/bare-except-required.md"
    severity: warning
---

# Bare `except:` Required for d3 Attribute Errors

## Problem

Some d3 Python objects raise errors that do **not** inherit from Python's `Exception` base class. This means `except Exception as e:` will NOT catch them — the error propagates uncaught and crashes the function.

**Known triggers:**
- `d3.projectPaths.projectSubFolder(...)` — raises `AttributeError` that bypasses `except Exception`
- Other d3 module-level attribute access on objects that don't exist in the current Designer version

## Proof

```python
# This CRASHES — error is not caught:
try:
    x = d3.projectPaths.projectSubFolder('VideoFile')
except Exception as e:
    pass  # never reached

# This WORKS — bare except catches it:
try:
    x = d3.projectPaths.projectSubFolder('VideoFile')
except:
    pass  # caught
```

Verified via probe: `except Exception` returns nothing (uncaught), `except:` returns `"caught bare"`.

## Rule

In Designer Python scripts, **always use bare `except:` (or `except BaseException:`) when accessing d3 attributes that may not exist.** This is especially important for:

- Optional API features (`d3.projectPaths`, version-specific attributes)
- Property access on d3 objects where the attribute might not be present
- Any `try/except` block that guards against d3 API availability

## Pattern

```python
# SAFE — catches all d3 errors including non-Exception types
try:
    value = d3.someAttribute.someMethod()
except:
    value = fallback_value

# UNSAFE — will crash on some d3 errors
try:
    value = d3.someAttribute.someMethod()
except Exception:
    value = fallback_value
```

## Note

Standard Python errors (KeyError, ValueError, TypeError from your own code) are still caught by `except Exception`. The bare `except:` is specifically needed for d3 internal errors that use non-standard exception hierarchies.
