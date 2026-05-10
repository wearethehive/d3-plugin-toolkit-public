---
type: bug
status: confirmed
title: except Exception does NOT catch built-in Python exceptions in Designer's embedded runtime
confirmed: 2026-05-07
tested: "2026-05-07"
severity: critical
---

## Symptom

HTTP 500 / PythonException with a standard Python exception traceback (ValueError,
TypeError, etc.) even though the offending line is wrapped in `except Exception:`.

Example:
```
class PythonException in 'C:\blip\dev\d3python\pythonobject.cpp' (line 32):
ValueError: invalid literal for int() with base 10: ''
```
even when the code is:
```python
try:
    v = int(val.enabledVersion)  # enabledVersion returns '' on live/NDI layers
except Exception:
    pass  # <-- NOT reached
```

## Root Cause

Designer's embedded Python 2.7 runtime intercepts standard Python exceptions at
the C++ level before Python's `except Exception:` clause can handle them. The C++
wrapper (`pythonobject.cpp`) re-raises them as PythonException, bypassing the
exception hierarchy that `except Exception` relies on.

Built-in Python exceptions that exhibit this behaviour:
- `ValueError` (confirmed — `int('')` crashes through `except Exception`)
- Likely: `TypeError`, `AttributeError`, `IndexError`, and all others

## What DOES work

- `except:` — bare except, catches everything (Python 2 only)
- `except ValueError:` — specific type catches that specific exception
- `except BaseException:` — catches everything including built-in types ✓

## Fix

Replace `except Exception:` in Designer Python scripts. Follow the repo standard:

- Use bare `except:` for Designer API guard blocks and restricted imports.
- Use `except BaseException as e:` only when the exception object is genuinely needed.

Do not use `except Exception:` around Designer API calls.

## Applied Fix

Designer-facing Python modules should replace broad `except Exception` guards
with either bare `except:` or `except BaseException as e:` depending on whether
the exception object is needed.

## Related Crasher

This is what caused the persistent HTTP 500 on the show track's `get_cuelist`:
- `val.enabledVersion` returns `''` for live camera and NDI overlay layers (VideoClip
  objects that represent a live feed, not a file)
- `int('')` raised ValueError
- `except Exception: pass` did NOT catch it
- Script died with 500 / no Python log

The fix was twofold:
1. Change broad `except Exception:` guards to the repo-standard catch pattern.
2. Avoid `int(val.enabledVersion)` on empty string: check `ev and ev != '0'` first.

## How It Was Found

CLI probing showed `int('')` raises `ValueError` in this runtime, and isolated
checks confirmed `except Exception:` does not catch it while `except
BaseException:` and bare `except:` both do.
