---
type: bug
status: confirmed
severity: crash
tested: "2026-06-15"
---

# lockToDirector() Causes ACCESS_VIOLATION Crash Loop in Designer Update Loop

## Symptom

Calling `tm.lockToDirector(source, jumpDirectorToMe)` on a `TransportManager`
from the Python sandbox triggers a cascade of errors ending in repeated
`ACCESS_VIOLATION` in `D3StateEditor.update`, looping every frame:

```
!!!!! Exception: ACCESS_VIOLATION: user-mode DEP violation at <address>
 Repeated 104 times
Error at 'MulticastDelegate::call <bound method D3StateEditor.update of <D3StateEditor object 'd3'>>':
RuntimeError: Exception: ACCESS_VIOLATION: user-mode DEP violation at <address>
  File "<designer>\scripts\gui\editor_d3state.py", line 497, in update
```

Prior to the crash loop, the following errors appear:

```
!!!!! Access to object of type 'Action' is not allowed.
  File "<designer>\scripts\gui\editor_d3state.py", line 265, in <lambda>
  Trace: < Call:lockToDirector < GetField:recordersChangedAction < ...

!!!!! Access to object of type 'Widget' is not allowed.
  File "<designer>\scripts\gui\editor_d3state.py", line 374, in populate
```

## Impact

**Crash-level.** Designer's `D3StateEditor.update` enters a per-frame crash
loop at a fixed address (dangling pointer). Designer requires restart to
recover. Behaviour observed on r33.2.1.

## Root Cause

`lockToDirector` is a UI-side C++ action. When invoked from Python it fires
`recordersChangedAction`, which triggers `editor_d3state.py` callbacks that
call `Widget::close` / `Widget::clear`. This frees (or invalidates) a Widget
that `D3StateEditor.update` holds a reference to. The update loop then hits
an access violation on every frame tick.

The `source` argument does not affect this — passing `None` or a valid resource
both produce the same crash cascade. The operation itself "succeeds" (returns
`ok: true` from Python) but leaves Designer's GUI state corrupted.

## Do Not Call

```python
# CRASH — do not call from Python sandbox
tm.lockToDirector(None, False)   # lock to director
tm.lockToDirector(None, True)    # drag to director
tm.lockToDirector(tm, True)      # also crash, plus "unrecognised source" error
```

## Alternative

No known Python alternative for this transport operation (as of r33.2.1).
The GUI-level lock/drag buttons in Designer's transport bar cannot be
replicated from the Python sandbox. If this feature is needed, consider
using Designer's OSC input to trigger the transport action from an external
controller, or wait for a future Python API surface.

## Related

- `bugs/layer-add-gui-side-effect.md` — same class: Widget errors from GUI
  callbacks triggered by Python. That one is cosmetic; this one is a crash.
- `patterns/c++-binding-non-exception-failures.md` — bare except required
  for C++ binding errors (does not help here — the crash happens asynchronously
  in the update loop, not at the call site)

