---
type: bug
status: observed
tested: "2026-08-21"
designer_version: "r34.0.3.258249"
severity: warning
---

# Registered module `import os` direct-name collision

## Symptom

In a registered plugin-module probe, a module-level `import os` did not provide
the expected Python stdlib module to exported functions. Calls such as
`os.path.join(...)` failed with:

```text
AttributeError: 'OS' object has no attribute 'path'
```

The same plugin module worked after changing the import to an alias:

```python
import os as _os
```

and updating filesystem calls to `_os.path...`.

## Evidence

The focused probe registered three cooperating Python modules through
`@disguise-one/designer-pythonapi`, then called their exported read-only
functions.

The first run failed in `list_csv_files()` and `scan_validate()` with
`'OS' object has no attribute 'path'`. After aliasing the import, the same probe
returned valid JSON from both functions.

## Guidance

For registered plugin modules that need filesystem access, prefer alias imports:

```python
import os as _os
```

This avoids colliding with Designer's injected `OS`-named object in observed
r34 registered-module execution.

## Caveat

This has been observed in an r34 registered-module path. Older plugins may still
contain direct `import os`; do not bulk-edit them without targeted regression
probes.
