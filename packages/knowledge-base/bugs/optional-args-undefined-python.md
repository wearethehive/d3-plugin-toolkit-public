---
type: bug
status: confirmed
severity: error
tested: "2026-04-11"
---

# Optional TypeScript Args Become `undefined` in Python Execute Scripts

## Symptom

Calling a registered Python module function from TypeScript while omitting
trailing optional parameters can return HTTP 500 before the Python function body
runs.

## Root Cause

The generated execute script interpolates `JSON.stringify(arg)` values into a
Python call. In JavaScript, `JSON.stringify(undefined)` returns the value
`undefined`, and template interpolation turns that into the literal text
`undefined`.

Generated Python then looks like:

```python
return my_fn("arg1", 2, undefined, undefined)
```

Python raises `NameError` because `undefined` is not defined. Designer surfaces
that as HTTP 500.

## Affected Shape

```python
def my_fn(required_a, required_b, optional_c=320, optional_d=180):
    ...
```

```ts
await my_fn(requiredA, requiredB)
```

## Workaround

Pass every argument explicitly from TypeScript, including values that Python
would otherwise default:

```ts
await my_fn(requiredA, requiredB, 320, 180)
```

If a wrapper API wants optional TypeScript parameters, normalize them on the TS
side before calling the generated Python module function.
