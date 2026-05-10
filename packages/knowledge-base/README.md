# Knowledge Base

Tested API documentation for Disguise Designer's Python execution environment.

## Structure

```
api/           - API method documentation (resourceManager, guisystem, etc.)
types/         - Type/class documentation (Indirection, KeySequence, etc.)
patterns/      - Tested code patterns (create-or-duplicate, safe iteration, etc.)
bugs/          - Known issues and workarounds
test-suites/   - Batch test definitions (JSON)
submissions/   - Public submission schema and workflow notes
test-log.jsonl - Append-only log of all test results
api/index.json - Machine-readable index of all entries
```

## Publishable KB Policy

The public knowledge base should publish conclusions, not raw inherited tools.

- Use `.md` files for canonical knowledge: API shapes, confirmed patterns,
  caveats, crashers, and short original examples.
- Use `.py` files in `reference-tools/` only for focused local probes that
  validate a KB claim against Designer.
- Do not publish transplanted utility scripts or origin notes. If a
  private tool contains useful information, rewrite the insight into the
  relevant Markdown entry in this repo's style.
- `related_files` frontmatter should point at KB Markdown entries. Probe files
  can be named in prose when they are important evidence, but they are not the
  public contract.

## Entry Format

Each markdown file follows this structure:

```markdown
# method or type name

**Status**: WORKS | WORKS_WITH_CAVEATS | BROKEN | UNTESTED
**Tested**: YYYY-MM-DD
**Designer Version**: rXX.x

## Description
What it does.

## Known Issues
Documented gotchas.

## Test Script
```python
# Python that validates behavior
```

## Test Result
```json
// What Designer returned
```
```

## Key Entries (VideoFile)

| File | Summary |
|---|---|
| `bugs/videofile-description-no-extension.md` | `vf.description` has no file extension; match against both forms |
| `patterns/videofile-unlock-and-move.md` | `unlockFile()` vs `moveToTrash()`, staging folder placement, `consolidateAllClips()` danger |

## Adding Entries

Use the CLI:
- `d3 test "expression"` — runs and records to test-log.jsonl
- `d3 probe TypeName` — introspects and records attributes

Manually: create a markdown file following the format above and add an entry to `api/index.json`.
