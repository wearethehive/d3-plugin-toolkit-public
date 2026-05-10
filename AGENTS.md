# d3-plugin-toolkit Agent Instructions

This repository builds plugins for Disguise Designer. Designer Python is a
crash-prone host API: do not guess behavior, do not invent method names, and do
not treat `packages/shared/d3.pyi` as the source of intended usage.

`CLAUDE.md` and `.claude/` are Claude Code configuration. Codex should not rely
on them for behavior. The Codex-facing workflow is this file plus
`docs/codex-workflows.md`.

## Project Map

- `packages/cli/` - `d3` CLI for exec, probe, discover, test-suite, scaffold,
  deploy, learn, and session snapshots.
- `packages/shared/` - shared TypeScript utilities, Vue composables, Python
  templates, Google Sheets helpers, and `d3.pyi`.
- `packages/knowledge-base/` - tested patterns, known bugs, reference probes,
  test suites, and session/test logs.
- `packages/plugins/` - plugin workspaces.
- `templates/plugin/` - scaffold source for new Vue/Vite plugins.
- `docs/reference.md` - Designer API notes, Python rules, known crashers, and
  plugin architecture.
- `docs/mandatory-workflow.md` - required workflow before Designer API changes.
- `docs/codex-workflows.md` - Codex work modes and checklists.

## Always-On Rules

- Preserve user work. Check the worktree before edits and never revert unrelated
  changes.
- Use `rg`/`rg --files` for repo searches.
- Keep edits scoped to the requested task and existing repo patterns.
- Treat `packages/shared/d3.pyi` as grep-only because it is large and exposes
  internal C++ surfaces that are not necessarily valid plugin APIs.
- Official Disguise docs plus tested local knowledge base entries outrank
  plausible inference from `d3.pyi`.

## Designer Python Pre-Flight

Before writing or changing any Python that touches Designer:

1. Read `docs/mandatory-workflow.md`.
2. Read the relevant sections of `docs/reference.md`.
3. Search `packages/knowledge-base/patterns/`, `bugs/`, and Python probes in
   `reference-tools/` for the API or behavior.
4. Grep `packages/shared/d3.pyi` for unfamiliar method/property names.
5. If no proven pattern exists, write and run a probe before implementing.
6. Record confirmed discoveries in the knowledge base.

Critical Python rules:

- Designer Python is Python 2.7: no f-strings.
- Put `import d3` inside function bodies for registered plugin modules.
- Use the injected `resourceManager` global, never `d3.ResourceManager.get()`.
- Use bare `except:` around Designer API calls and restricted imports.
- Do not use direct `for x in collection` on d3 proxy collections unless a
  confirmed pattern says that collection is native.
- Never inline substantial Python in TypeScript. Put Python in `.py` modules
  with `__all__` exports and call it through `@disguise-one/designer-pythonapi`.
- Every Designer method name must exist in `packages/shared/d3.pyi`; if it does
  not, stop and probe.

## Frontend Rules

- Plugins use Vue 3, Vite, `@disguise-one/designer-pythonapi`, and
  `@disguise-one/vue-liveupdate`.
- Use Live Update subscriptions for realtime Designer state instead of polling
  Python execute.
- Vite must keep `base: './'` and single-chunk output for Designer CEF.
- Keep Designer API behavior in Python modules; keep UI state and presentation in
  Vue/composables.
- For plugin config/distribution behavior, check `docs/reference.md` and the
  official Disguise plugin docs.

## Verification

Use the smallest meaningful verification for the change:

- Toolkit/shared changes: `npm run build:cli`, `npm run build:shared`, and/or
  `npm run test`.
- Plugin changes: `npm -w packages/plugins/<plugin> run build`.
- Designer Python behavior: run a probe or test suite against Designer when
  available, and document the result.

Plugin builds run `scripts/check-build-ready.mjs` where wired into Vite. That
check is a repo-level safety net, not a substitute for the pre-flight above.

## Knowledge Capture

After any Designer Python discovery:

- New confirmed pattern: add `packages/knowledge-base/patterns/<name>.md`.
- New confirmed bug/crasher: add `packages/knowledge-base/bugs/<name>.md`.
- Probe/test result: append to `test-log.jsonl` or `session-log.jsonl` through
  the CLI when possible.
- Important repeated or dangerous discoveries should be proposed for promotion
  to `docs/reference.md`; the user decides.

