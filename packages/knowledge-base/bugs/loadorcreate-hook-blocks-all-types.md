---
type: bug
status: confirmed
severity: error
tested: "2026-04-08"
---

# kb-coverage Hook Blocks loadOrCreate for All Types

## Symptom

The kb-coverage hook (`scripts/check-kb-coverage.mjs`) blocks
`resourceManager.loadOrCreate(...)` **unconditionally** whenever the
`create-or-duplicate.md` pattern file exists. A probe or plugin Python
script that uses `resourceManager.loadOrCreate(path, SomeNonCrashingType)`
is blocked by the hook with no obvious workaround, even for resource
types that work fine with `loadOrCreate`.

## Root cause

The hook's intent was to enforce the create-or-duplicate workaround for
types known to crash (`Indirection`, `ListIndirectionController` — see
[loadOrCreate-access-violation.md](loadOrCreate-access-violation.md)),
but the rule in `scripts/lib/api-coverage.mjs` is type-agnostic. It
matches any call to `resourceManager.loadOrCreate` regardless of the
type argument.

## Workaround

Use the constructor + explicit path assignment + parent collection
membership pattern instead:

```python
import d3
evt = d3.EventTransportOSC()
evt.path = "objects/eventtransportosc/my-transport.apx"
evt.osc_device = some_osc_device
# Add to parent collection — this triggers Designer's normal save lifecycle
tm.local_transports = list(tm.local_transports) + [evt]
resourceManager.saveAll()
```

This was confirmed to work for `EventTransportOSC` in
`probe_eventtransport_osc_v2.py` (final form). The pattern is:
`_blipValue` instances added to a parent collection get persisted
through the parent's save lifecycle, even without going through
`loadOrCreate`.

## Long-term fix

The `API_COVERAGE` entry in `scripts/lib/api-coverage.mjs` for
`resourceManager.loadOrCreate` should be refined to only block for the
specific types listed in `create-or-duplicate.md`'s "known crashers"
section (`Indirection`, `ListIndirectionController`), not universally.
This is a toolkit fix flagged for the Toolkit Engineer.

## CLAUDE.md candidate

Refine the kb-coverage hook to be type-specific, so non-crashing
`loadOrCreate` calls are not blocked.

## Related

- [create-or-duplicate.md](../patterns/create-or-duplicate.md)
- [loadOrCreate-access-violation.md](loadOrCreate-access-violation.md)
- [python-attribute-assignment-is-permissive.md](../patterns/python-attribute-assignment-is-permissive.md)
