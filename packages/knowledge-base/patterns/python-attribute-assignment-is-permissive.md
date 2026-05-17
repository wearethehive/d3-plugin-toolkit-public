---
type: pattern
status: confirmed
tested: "2026-04-08"
---

# Python Attribute Assignment on _blipValue Is Permissive

## The problem

When you call `setattr(some_blip_value, "newattr", value)` on a
`_blipValue` instance — which is what every Designer Resource and Device
wrapper is — **Python silently succeeds even if `newattr` is not a real
attribute on the underlying C++ class.** No exception is raised. A
subsequent `getattr` may even return the value you just wrote, because
Python stored it on the instance dict of the Python wrapper.

This produces **false positives in probes** that interpret "no exception"
as "the attribute is real." It also produces silent data loss in plugin
code, because the assigned value never reaches the underlying C++ object
and is lost on the next save/load cycle.

## Concrete example from the investigation

A probe attempted to set 5 plausible attribute names on a
`d3.ExpressionVariable` instance, looking for the runtime expression-formula
property:

```python
ev = d3.ExpressionVariable()
ev.expression      = "osc:/probe/test"   # appeared to succeed
ev.formula         = "osc:/probe/test"   # appeared to succeed
ev.valueExpression = "osc:/probe/test"   # appeared to succeed
ev.currentExpression = "osc:/probe/test" # appeared to succeed
ev.definition      = "osc:/probe/test"   # appeared to succeed
```

All 5 calls "succeeded" — no exceptions, no errors. The probe report
flagged this as evidence that `ExpressionVariable` had a settable
expression formula. **It does not.** None of those names are real
attributes on the class.

`dir(ev)` returns only:

```
[FloatType, FunctionType, StringType, defaultFloat, defaultString,
 errorText, makeExpression, name, null, type]
```

The setattr calls were stored as instance attributes on the Python wrapper
but never reached the underlying C++ object. The companion probe
`probe_real_expvar_device.py` verified this explicitly: after the "successful"
setattr calls, the real persisted `ExpressionVariablesDevice` on disk
showed none of the written values. They were dropped on the next save/load
cycle.

## The safe verification pattern

Always check the attribute against `dir(type(obj))` before assignment,
and read back via `getattr` after:

```python
def safe_setattr(obj, name, value):
    """Verify the attribute is real on the underlying class before writing."""
    if name not in dir(type(obj)):
        return False  # not a real attribute on the class
    setattr(obj, name, value)
    # Read back and confirm it took
    try:
        return getattr(obj, name) == value
    except:
        return False
```

For probe scripts specifically, the rule is:

1. Enumerate real attributes via `dir(instance)` or `dir(type(instance))`
2. **Only** attempt `setattr` on attributes that appear in that list
3. After `setattr`, verify the value with `getattr`
4. If the resource is persisted, verify the value survives a save/load
   cycle — the Python-wrapper-only writes will be silently lost

## Why _blipValue does this

`_blipValue` is the Python wrapper around Designer's reflection-based C++
object model. Python's normal object model allows arbitrary attribute
assignment on an instance unless `__slots__` is set. `_blipValue` does
not appear to use `__slots__`, so attribute writes that don't correspond
to a real C++ reflected field land in the wrapper's `__dict__` and are
silently lost when the wrapper is discarded or the object is re-serialised.

This is not a bug per se — it's how Python instances work by default. But
because most Designer code treats `_blipValue` wrappers as opaque handles
to C++ objects, the naive mental model ("assignment either works or
raises") is wrong, and probes built on that mental model produce false
positives.

## Related

- [c++-binding-non-exception-failures.md](c++-binding-non-exception-failures.md) — sister gotcha for method calls on the same objects
- [bare-except-required.md](bare-except-required.md) — needed when verification reads throw non-Exception errors
- [disguise-docs-as-source-of-truth.md](disguise-docs-as-source-of-truth.md) — reading docs first avoids probing non-existent attributes
