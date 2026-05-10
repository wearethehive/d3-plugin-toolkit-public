---
type: bug
status: confirmed
tested: "2026-05-04"
severity: crash
---

# Large inline string embedded in execute() causes HTTP 500

## Symptoms

HTTP 500 with no Python log. Crash happens at engine/HTTP layer before Python
runs.

## Root cause

The Designer execute API has an effective size limit on the Python script body.
When a large string (e.g. a full CSV export) is JSON-stringified and embedded
directly in the script string passed to `execute()`, the combined payload
exceeds that limit and the request is rejected at the engine level — bypassing
all Python try/except.

Example of the **wrong** pattern:

```typescript
const csv = buildCsvText(sections.value)   // could be hundreds of KB
const resp = await execute(
  moduleSource + '\nreturn write_csv_file("name", ' + JSON.stringify(csv) + ')'
)
// → HTTP 500 if moduleSource + csv is too large
```

## Fix

Never embed large data inline in the Python script body. Instead:

1. Pass only small parameters (IDs, keys, column names) to Python.
2. Have Python fetch or compute the large data itself on the Designer side.

**Right pattern for CSV export:**

```typescript
// Pass only the list of visible column keys (tiny JSON array)
const visibleCols = OPTIONAL_COLS
  .filter(c => !hiddenCols.value.has(c.key))
  .map(c => c.key)

const resp = await execute(
  moduleSource +
  '\nreturn save_cuelist_csv_cols(' +
  JSON.stringify(trackPath) + ',' +
  JSON.stringify(JSON.stringify(visibleCols)) + ')'
)
```

Python's `save_cuelist_csv_cols` then calls `get_cuelist()` internally,
builds the CSV, and writes the file — nothing large crosses the API boundary.

## General rule

If the data you want to send to Python is larger than ~a few KB, reverse the
flow: send a query key to Python and let Python fetch the data from Designer
directly. The execute API is designed for small parameters, not bulk transfer.
