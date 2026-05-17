---
type: bug
status: observed
severity: error
tested: "2026-04-11"
crashers:
  - pattern: "(?:^|\\n)import\\s+atexit\\b"
    condition: "__all__|registerModule|registered module"
    message: "Top-level import atexit is unsafe in registered Designer Python modules. Import inside a function or avoid it."
    severity: error
---

# Top-Level `atexit` Can Break Registered Module Loading

## Symptom

`import atexit` works inside an anonymous Designer exec script, but is unsafe
at module level in a `registermodule` context. The observed failure mode was
that module registration could be silently prevented before exported functions
were usable.

## Rule

Do not import `atexit` at module level in `.py` files loaded through
`@disguise-one/designer-pythonapi`.

```python
__all__ = ["do_work"]

def do_work():
    import atexit  # only if absolutely needed; prefer avoiding it
    return "ok"
```

For long-running child processes or bridge servers, use explicit shutdown
endpoints or PID tracking instead of relying on `atexit`.

## Status

The unsafe behavior is confirmed, but the exact internal failure mode is not
fully characterized. Treat it with the same caution as
`bugs/registermodule-import-d3.md`.
