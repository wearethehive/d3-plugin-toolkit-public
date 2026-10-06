---
type: pattern
status: confirmed
tested: "2026-08-17"
designer_version: "r34.0.3"
---

# Reading a Live Expression Value For UI Feedback

## Concept

A plugin control can sample Designer's live-computed value for an expression as
read-only feedback using `d3.Expression.evaluateFromString()`. This is the only
confirmed read path for this case; see the negative results below.

```python
import d3
value = float(d3.Expression.evaluateFromString('floor(osc:d3.cc.0 * 100) / 100'))
```

Returns a native Python numeric type directly (`long` for integer results,
presumably `float` for non-integer ones) — no `.value` unwrap needed, just
`float()` it.

## What works

- A full arithmetic/literal expression string using **documented built-in
  prefixes** — `osc:address.path`, `camera:...`, `math.*`, plain numeric
  literals/operators. Confirmed: `d3.Expression.evaluateFromString('1+1')`
  → `2`; `d3.Expression.evaluateFromString('floor(osc:d3.cc.0 * 100) / 100')`
  → a live float tracking the current OSC input.

## What does NOT work (confirmed negative results)

- **Bare custom `ExpressionVariablesDevice` function names**, even when the
  device is active (`is_added: True` in `DeviceManager.devices`) and the
  variable's own `errorText` is empty (proving it evaluates fine wherever
  it's actually used in the project):
  ```python
  d3.Expression.evaluateFromString('cambright()')
  # RuntimeError: Name 'cambright' not found
  ```
  The static evaluator does not have custom project-defined names in scope
  when called this way. No working method found yet to resolve a custom
  device function name directly — only the underlying documented-prefix
  formula it's built from (if known) is readable.
- **A bare `osc:` address with no arithmetic around it**:
  ```python
  d3.Expression.evaluateFromString('osc:d3.cc.0')
  # RuntimeError: Unable to convert array to reflection value
  ```
  Wrapping it in arithmetic (even trivial, e.g. `osc:d3.cc.0 + 0`) avoids
  this — the raw OSC argument apparently comes back as an array/bundle type
  that doesn't convert directly, but any arithmetic on it coerces to a
  scalar. Always evaluate the full formula, never the bare address.
- **`FieldSequence.expression` on the actual layer/field being driven** — for
  a Notch layer field externally bound (MIDI-CC-driven in the case tested,
  `disableSequencing: true`, `isPatched: false`), `.expression` was `None`
  and `.getSequencedValue()` returned a static default, not the live value.
  The binding bypasses the classic Expression API entirely at that layer.
- **`ExpressionVariable.makeExpression()`** — returns the *call syntax*
  string to reference the variable elsewhere (e.g. `"cambright()"`), not an
  evaluated value.
- **Standalone `d3.FieldSequence()` construction as a scratch evaluator** —
  crashes. See `bugs/fieldsequence-standalone-construction-uninitialized-crash.md`.
  Do not attempt this route again.

## Practical implication

If you know (or the user tells you) the exact underlying formula in terms
of documented prefixes — e.g. they configured a custom `ExpressionVariablesDevice`
function as `floor(osc:d3.cc.0 * 100) / 100` — evaluate *that formula string*
directly rather than the custom function name. This also means the feedback
value genuinely reflects live changes from any external source hitting that
same OSC address/prefix, not just this plugin's own sends.

Do not put this behind an overlapping fixed-interval Python poll. Sample on
demand or use a single back-pressured bridge call; see
`plugin-cef-polling.md`.

## Related

- `expression-api.md` — `setExpression()` / `ExpressionVariablesDevice` basics
- `bugs/fieldsequence-standalone-construction-uninitialized-crash.md`
- `fieldsequence-eval-deprecated-for-plugins.md`

