# Codex Workflows

These work modes replace the Claude-specific multi-agent ritual for Codex.
Use them as checklists and review lenses. Do not spawn subagents unless the user
explicitly asks for parallel agent work.

## Coexistence With Claude

Claude and Codex can live side by side in this repo:

- `CLAUDE.md` remains the Claude Code memory file.
- `.claude/` remains Claude-only hooks, commands, and local permissions.
- `AGENTS.md` is the Codex-facing root instruction file.
- This document is the Codex workflow playbook.

If a rule exists in both systems, keep the intent aligned but do not depend on
one assistant reading the other assistant's private configuration.

## Work Mode: Designer Python

Use for Python that executes inside Designer: resources, layers, tracks,
transports, expressions, devices, registered modules, and plugin `.py` files.

Checklist:

1. Read `docs/mandatory-workflow.md`.
2. Read relevant `docs/reference.md` sections.
3. Search `packages/knowledge-base/patterns/`, `bugs/`, and Python probes in
   `reference-tools/`.
4. Grep `packages/shared/d3.pyi` for unfamiliar methods and properties.
5. Use official Disguise docs before forming hypotheses about intended API use.
6. If the KB has no pattern, write a focused probe and run it in the same
   execution context as the plugin.
7. Add or update KB documentation when behavior is confirmed.

Implementation constraints:

- Python 2.7 only.
- No f-strings.
- No module-level `import d3` in registered plugin modules.
- Use `resourceManager` global, not `d3.ResourceManager.get()`.
- Use bare `except:` when touching Designer APIs.
- Use JSON-serializable return values only.
- Avoid returning raw d3 objects to TypeScript.
- Keep scripts short because execution blocks Designer's main application
  thread.

## Work Mode: Plugin Frontend

Use for Vue components, TypeScript composables, Vite config, manifests, plugin
layout, and integration with Python modules.

Checklist:

1. Read the Plugin Architecture section of `docs/reference.md`.
2. Search the KB for frontend-relevant patterns, especially Live Update, CEF
   polling, and console debugging.
3. Keep Python in `.py` modules with `__all__`; do not inline large Python in
   TypeScript.
4. Use typed composables for API calls and UI state.
5. Build the plugin before completion.

CEF/plugin constraints:

- `base: './'` in Vite.
- Single-chunk output.
- Use Live Update for realtime values.
- Expect CEF background throttling; persist state and resume on mount where
  needed.

## Work Mode: Toolkit

Use for `packages/cli`, `packages/shared`, scaffold templates, build tooling,
and monorepo structure.

Checklist:

1. Avoid modifying plugin workspaces unless the task explicitly needs it.
2. Treat `packages/shared/d3.pyi` as read-only.
3. When changing `templates/plugin`, consider whether existing plugins need the
   same update.
4. Run focused tests/builds for the affected package.

## Work Mode: QA

Use for code reviews, validation passes, build failures, and Designer Python
signoff.

Designer Python audit:

- Is `d3` imported at module level?
- Is `d3.ResourceManager.get()` used?
- Is `resourceManager.loadOrCreate()` used where a create-or-duplicate pattern
  is required?
- Is `ctrl.resources.append()` used instead of full list assignment?
- Is `ind.expectedType` missing?
- Is `track.addNewLayer` called with exactly four arguments?
- Is `resourceManager.load()` called without a type argument?
- Is `except Exception` used around Designer API calls where bare `except:` is
  required?
- Is direct iteration used on d3 proxy collections?
- Are plugin Python functions returning raw d3 objects instead of JSON-safe data?
- Are large Python snippets inlined in TypeScript?

QA should report specific failure modes and point to the relevant KB or docs.

## Work Mode: Knowledge Curator

Use after Designer Python work, probes, crashes, or API discoveries.

Checklist:

1. Write new crash docs for confirmed crashers or unsafe calls.
2. Write pattern docs for confirmed safe approaches.
3. Record test/probe results through the CLI when possible.
4. Propose `docs/reference.md` promotions for repeated or severe findings.
5. Leave unresolved areas labeled as "no working method found yet", not
   "impossible", unless the evidence really supports impossibility.

Promotion threshold:

- Confirmed Designer crash: immediate candidate for `docs/reference.md`.
- Repeated issue across sessions: candidate for `docs/reference.md`.
- User approves promotions from KB into core reference docs.

## Session Shape

For normal Codex work:

1. Identify the work mode.
2. Gather the minimum required context.
3. State any non-obvious plan before edits.
4. Implement.
5. Verify.
6. Capture new knowledge if Designer Python behavior changed or was discovered.

For risky Designer Python work, do not compress steps 1-3. The cost of a wrong
guess is a crashed Designer session.

