---
type: pattern
status: confirmed
tested: "2026-04-08"
---

# C++ Binding Methods Can Fail with Non-Exception Errors

## The pattern

Many methods exposed on `_blipValue` instances are `ReflectionCallable`
objects that wrap C++ class methods via Designer's reflection system.
**Just because a method exists in `dir()` doesn't mean it's callable from
Python in a meaningful way.** When called with the wrong signature, or
when the underlying C++ logic isn't designed for Python invocation
context, these methods raise errors that **don't subclass Python's
`Exception`**.

This is the same failure class as the restricted-import errors documented
in [bare-except-required.md](bare-except-required.md). The `bare except:`
rule applies here too.

## Symptoms

- Method exists in `dir(obj)` and shows as `ReflectionCallable`
- Calling it raises something that `except Exception:` does **not** catch
- The error is invisible to standard Python try/except patterns
- `obj.error` is empty string and `obj.isInError` is `False` — the
  underlying C++ class doesn't *report* the failure, the binding layer
  raises a non-catchable error
- In probes that wrap calls with `safe(lambda: ...)` using a bare
  `except:`, the wrapped lambda "returns None" with no diagnostic —
  that's the signature of a non-Exception failure swallowed by the bare
  except

## Confirmed examples from the investigation

### MetaField.get() — fails on every signature

Designer auto-creates `internal/metafield/<class>/<fieldname>.apx`
resources for every named property on every Resource. The `MetaField`
class has a `get` method exposed via reflection, which *looks* like a
live value reader — read the metafield, receive the current value.

It fails on every argument shape tested:

```python
mf = resourceManager.load(
    "internal/metafield/expressionvariablesdevice/testfloat.apx",
    d3.MetaField,
)

mf.get()                              # non-Exception failure
mf.get(target_device)                 # non-Exception failure
mf.get(target_variable)               # non-Exception failure
mf.get(target_device.uid)             # non-Exception failure
mf.get(str(target_device.path))       # non-Exception failure
mf.get(target_device, 0.0)            # non-Exception failure
```

The probe also tested `MetaField.get` against a transport manager's
volume metafield — a known live value visible in Designer's GUI as the
master volume slider:

```python
vol_mf = resourceManager.load(
    "internal/metafield/transportmanager/volume.apx",
    d3.MetaField,
)
vol_mf.get(transport_manager)         # non-Exception failure
```

Same result. **`MetaField.get` is exposed but not Python-callable**,
regardless of calling convention, argument count, or target object type.
The method is internal C++ machinery, not a plugin-facing API.

### d3.Expression.evaluateFromString — parser-only

`d3.Expression()` constructs successfully. `evaluateFromString` works for
context-free expressions where the Expression engine doesn't need to
traverse Designer's runtime identifier namespace:

```python
expr = d3.Expression()
expr.evaluateFromString("42")           # → 42      ✅
expr.evaluateFromString("1 + 2")        # → 3       ✅
expr.evaluateFromString("time")         # → 0.0     ✅ (parser knows the symbol)
```

But anything that requires a runtime identifier lookup fails with a
non-Exception error:

```python
expr.evaluateFromString("math.sin(0)")            # non-Exception failure
expr.evaluateFromString("osc:/timecode/select")   # non-Exception failure
expr.evaluateFromString("osc:/anything")          # non-Exception failure
```

The Expression class is exposed via reflection but its
`evaluateFromString` is for **parser validation of context-free strings**,
not for live evaluation of expressions that traverse Designer's
identifier namespace. The full expression engine only runs inside the
rendering pipeline against a real `FieldSequence` on a real layer
property.

## How to defend against this in probes

1. **Always wrap reflection-method calls in bare `except:`**, not
   `except Exception:`. Any probe that uses `except Exception` here will
   crash on the first uncatchable error and report nothing.

2. **If a method appears to "fail silently" (no exception, no result),
   check whether the wrapped lambda returned `None`** — that's the
   signature of a non-Exception failure caught by a bare except in the
   probe's `safe()` helper. `None` returns from `safe()` are evidence of
   failure, not of a method that returned `None`.

3. **Cross-reference with the docs**: if the method isn't documented at
   `https://developer.disguise.one`, it's almost certainly an internal
   C++ method exposed by reflection and not intended for plugin use. See
   [disguise-docs-as-source-of-truth.md](disguise-docs-as-source-of-truth.md).

4. **Don't conclude a Python value-read path doesn't exist just because
   reflection methods fail.** The value may be exposed via a different
   surface — LiveUpdate WebSocket, REST API, or a property on a different
   class. The investigation that produced this pattern eventually
   concluded that reading certain Designer runtime values from Python is
   structurally impossible, but that conclusion required exhausting
   alternatives, not just observing reflection failures.

## Related

- [bare-except-required.md](bare-except-required.md) — sister rule for catching these errors
- [python-attribute-assignment-is-permissive.md](python-attribute-assignment-is-permissive.md) — sister gotcha for attribute writes on the same objects
- [disguise-docs-as-source-of-truth.md](disguise-docs-as-source-of-truth.md) — methodology rule that would have caught these earlier
