# Codex Workflows

This document is load-bearing. Codex must use it as the operating contract for
this repository, not as optional guidance. The goal is parity with the Claude
workflow while matching how Codex actually works.

`AGENTS.md` loads the always-on rules. This file decides how a task is run.

## Coexistence With Claude

Claude and Codex can live side by side in this repo:

- `CLAUDE.md` remains the Claude Code memory file.
- `.claude/` remains Claude Code hooks, commands, and local permissions.
- `docs/agents.md` remains the Claude multi-agent source workflow.
- `AGENTS.md` is the Codex-facing root instruction file.
- `.codex/hooks.json` mirrors the portable hook checks where Codex supports
  repo-local hook configuration.
- This document is the Codex workflow playbook.

If a rule exists in both systems, keep the intent aligned. Codex must not depend
on Claude reading Codex files, and Codex must not depend on reading private
Claude local settings.

## Mandatory Operating Model Gate

Before implementation, Codex must choose one of two operating models and say
which one is being used when the choice is not obvious.

### Model A: Single-Agent Plugin Work

Use this for established plugin work where the toolkit is being used the way a
normal public user would use it:

- Building, testing, or maintaining an existing plugin.
- Small UI or TypeScript changes inside one plugin.
- Applying a known Designer Python pattern from the knowledge base without
  changing the pattern.
- Minor documentation updates that do not alter workflow rules.
- Verification of scaffolded output or plugin build behavior.

In this model, one Codex agent performs all relevant roles directly. It still
must run the required pre-flight checks before Designer Python work, verify the
change, and complete the Single-Agent Knowledge Report.

Required toolkit entry points:

- Read `docs/cheat-sheet.md` for current CLI commands.
- Use `npm run cli -- scaffold <plugin>` for new local plugin workspaces.
- Use `npm run cli -- scaffold <plugin> -- --type remote --backend python`
  or `--backend node` for new remote plugin workspaces.
- Use `npm -w packages/plugins/<plugin> run build` for local plugin
  verification.
- Use `npm run cli -- remote smoke <plugin>` and
  `npm run cli -- remote build <plugin>` for remote plugin verification.
- Use `npm run cli -- exec`, `test`, `test-suite`, `session`, and focused
  reference-tool probes for live Designer validation when Designer behavior is
  involved.

### Model B: Orchestrated Structural Work

Use this for larger or riskier work where role separation is load-bearing:

- New or unfamiliar Designer Python API behavior.
- Any Designer crash, unsafe operation, probe, or destructive API path.
- Changes to `packages/cli`, `packages/shared`, `templates/plugin`, build
  tooling, public export behavior, hooks, or assistant workflows.
- Cross-plugin changes or changes that affect future scaffolded plugins.
- Remote plugin scaffold, backend, packaging, or publishing changes.
- Knowledge-base schema, curation, test-suite, or reference-doc structure.
- Any task the user explicitly describes as multi-agent, structural, or
  requiring orchestration.

In this model, Codex must state the role sequence before implementation. If the
user explicitly asks for subagents, delegation, or parallel agent work, Codex may
spawn subagents for the roles. Otherwise Codex must execute the same role gates
sequentially in one agent and label the handoffs in its own work. The role gates
are mandatory either way.

Required toolkit entry points:

- Read `docs/cheat-sheet.md` before assuming how scaffold, probe, deploy, or
  knowledge promotion commands work.
- Use the CLI to scaffold new plugins and to run live Designer checks.
- Use the KB as the first source of implementation truth; `d3.pyi` is only a
  signature grep target.

## Role Briefs

### Designer Python Engineer

Invoke for any Python executing inside Designer: resources, layers, tracks,
transports, expressions, devices, registered modules, and plugin `.py` files.

Mandatory pre-flight before a single line of Designer Python is written:

1. Read `docs/mandatory-workflow.md`.
2. Read the relevant sections of `docs/reference.md`.
3. Search `packages/knowledge-base/patterns/` and
   `packages/knowledge-base/bugs/`.
4. Search Python probes in `packages/knowledge-base/reference-tools/`.
5. Grep `packages/shared/d3.pyi` for unfamiliar methods and properties.
6. Check the relevant official Disguise documentation before forming a
   hypothesis from `d3.pyi`.
7. If no proven pattern exists, write and run a focused probe before
   implementing.

Rules:

- Python 2.7 only.
- No f-strings.
- Put `import d3` inside function bodies for registered plugin modules.
- Use the injected `resourceManager` global, never `d3.ResourceManager.get()`.
- Use bare `except:` around Designer API calls and restricted imports.
- Do not directly iterate d3 proxy collections unless a confirmed pattern says
  the collection is native.
- Return JSON-safe values to TypeScript, never raw d3 objects.
- Produce a `DEFERRED` note for anything avoided, uncertain, or left for another
  role.

### Plugin Frontend Engineer

Invoke for Vue components, TypeScript, composables, Vite config, manifests,
plugin layout, and integration with Python modules.

Mandatory pre-flight:

1. Read the Plugin Architecture section of `docs/reference.md`.
2. Search `packages/knowledge-base/` for frontend-relevant patterns.
3. For plugin config or distribution questions, check official Disguise plugin
   docs.

Rules:

- Keep Designer API behavior in `.py` modules with `__all__` exports.
- Do not inline substantial Python in TypeScript.
- Use Live Update subscriptions for realtime Designer state instead of polling
  Python execute.
- Keep `base: './'` and single-chunk Vite output.
- Keep UI state and presentation in Vue/composables.
- If Python changes are needed, hand them to the Designer Python role rather
  than quietly blending responsibilities.
- For remote plugins, keep backend service code separate from any Python payload
  executed inside Designer. External Python can use `# d3-check:
  external-python`, but Designer-executed payloads still need the full Designer
  Python pre-flight.

### Toolkit Engineer

Invoke for `packages/cli`, `packages/shared`, `templates/plugin`, build tooling,
export scripts, hooks, docs that define workflow, and monorepo structure.

Rules:

- Avoid modifying plugin workspaces unless the task explicitly needs it.
- Treat `packages/shared/d3.pyi` as read-only except for deliberate stub updates.
- When changing scaffold templates, consider whether existing plugins need the
  same change.
- Run focused tests/builds for the affected package.
- Produce a `DEFERRED` note for compatibility concerns or intentionally skipped
  follow-up.

### QA Engineer

Invoke before Designer Python work is considered done, after bug fixes, when
validating a new pattern, and during structural work before final handoff.

Designer Python audit:

- Is `d3` imported at module level?
- Is `d3.ResourceManager.get()` used?
- Is `resourceManager.loadOrCreate()` used where create-or-duplicate is
  required?
- Is `ctrl.resources.append()` used instead of full list assignment?
- Is `ind.expectedType` missing?
- Is `track.addNewLayer` called with exactly four arguments?
- Is `resourceManager.load()` called without a type argument?
- Is `except Exception` used around Designer API calls where bare `except:` is
  required?
- Is direct iteration used on d3 proxy collections?
- Are plugin Python functions returning raw d3 objects instead of JSON-safe data?
- Is substantial Python inlined in TypeScript?

QA reports specific failure modes and points to the relevant KB or docs. In
orchestrated work, QA does not silently fix its own findings; the appropriate
implementation role handles them.

### Knowledge Curator

Invoke after Designer Python work, probes, crashes, API discoveries, and
structural workflow/toolkit changes. Knowledge capture is not optional.

Core responsibilities:

- New confirmed crash or unsafe call: add
  `packages/knowledge-base/bugs/<name>.md`.
- New confirmed pattern: add `packages/knowledge-base/patterns/<name>.md`.
- Probe or test result: record it through the CLI when possible.
- Testable regression: add or update a test suite entry.
- Severe or repeated discovery: propose promotion to `docs/reference.md`; the
  user decides.
- Unresolved areas must be labeled "no working method found yet", not
  "impossible", unless the evidence really supports impossibility.

## Mandatory Knowledge Reports

The curation brief differs by operating model.

### Single-Agent Knowledge Report

Use at the end of Model A work. This is concise but mandatory.

Required output:

- State whether Designer Python behavior was touched.
- State whether any new API behavior, crash, unsafe call, or reusable pattern
  was discovered.
- If yes, add or update the relevant KB/test-log/test-suite files before final
  response.
- If no, explicitly say no KB update was needed because no new Designer behavior
  was discovered.
- Mention the verification command that was run or why it could not be run.

### Orchestrated Curator Report

Use as the final role in Model B work.

Required output:

- Collect `DEFERRED` notes from all roles.
- Summarize new discoveries, confirmed patterns, crashes, and unresolved
  uncertainties.
- Add or update KB files, test-suite files, and logs where the work created new
  knowledge.
- Propose `docs/reference.md` promotions for confirmed crashes, repeated
  failures, or rules that future agents must see early.
- State whether the public assistant workflow files remain aligned:
  `AGENTS.md`, `docs/codex-workflows.md`, `CLAUDE.md`, `docs/agents.md`,
  `.claude/settings.json`, and `.codex/hooks.json`.

## Workflow Templates

### Established Plugin Work

Model: Single-Agent Plugin Work.

1. Identify the plugin and affected surface.
2. Read only the relevant docs and KB entries.
3. Apply existing patterns exactly.
4. Build or test the plugin.
5. Complete the Single-Agent Knowledge Report.

### New Plugin From User Prompt

Model: Orchestrated Structural Work when the plugin touches Designer Python or
unfamiliar Designer behavior; otherwise Single-Agent Plugin Work is acceptable
for a frontend-only/static plugin.

1. Toolkit Engineer: read `docs/cheat-sheet.md` and scaffold with
   `npm run cli -- scaffold <plugin-name> -- --title "..."` for local plugins,
   or `npm run cli -- scaffold <plugin-name> -- --type remote --backend python`
   for remote plugins.
2. Designer Python Engineer: search the KB and reference probes for each
   Designer API the plugin needs.
3. Designer Python Engineer: run focused live Designer probes when behavior is
   not already proven.
4. Plugin Frontend Engineer: implement Vue/composables and Python module calls.
5. QA Engineer: build the plugin and audit Designer Python crash risks.
6. Knowledge Curator: update KB/logs if new behavior was learned and complete
   the required knowledge report.

### New Plugin Feature With Designer Python

Model: Orchestrated Structural Work.

1. Designer Python Engineer: pre-flight, probe if needed, implement `.py`.
2. QA Engineer: crasher audit and regression review.
3. Designer Python Engineer: fix QA findings.
4. Plugin Frontend Engineer: wire Vue/composables/UI.
5. QA Engineer: build/test verification.
6. Knowledge Curator: KB updates and Orchestrated Curator Report.

### Designer Crash Bug Fix

Model: Orchestrated Structural Work.

1. QA Engineer: characterize crash against known crashers.
2. Designer Python Engineer: pre-flight, probe, and implement fix.
3. QA Engineer: verify fix and regression surface.
4. Knowledge Curator: update `bugs/`, test logs, and promotion candidates.

### Toolkit Or Scaffold Change

Model: Orchestrated Structural Work.

1. Toolkit Engineer: make the scoped change and flag compatibility concerns.
2. Plugin Frontend Engineer if scaffold/plugin output is affected.
3. QA Engineer: run focused package tests/builds.
4. Knowledge Curator: update docs or KB if the toolkit workflow changed.

### Knowledge Base Audit

Model: Orchestrated Structural Work.

1. Knowledge Curator: review logs and entries for undocumented findings.
2. QA Engineer: add missing test-suite coverage where appropriate.
3. Toolkit Engineer if CLI/schema/index behavior must change.
4. Knowledge Curator: present promotion candidates to the user.

## Promotion Threshold

Promote a KB item to `docs/reference.md` as a candidate when:

- A Designer crash is confirmed.
- The same issue appears in two or more sessions.
- A workflow omission caused unsafe behavior.
- A new Designer version changes a known behavior.

Agents propose. The user decides.

## Session Shape

Every Codex session follows this shape:

1. Choose Model A or Model B.
2. Gather the minimum required context for the selected roles.
3. State a non-obvious plan before edits.
4. Implement with role boundaries intact.
5. Verify with the smallest meaningful test/build/probe.
6. Complete the required knowledge report.

For risky Designer Python work, do not compress steps 1-3. The cost of a wrong
guess is a crashed Designer session.
