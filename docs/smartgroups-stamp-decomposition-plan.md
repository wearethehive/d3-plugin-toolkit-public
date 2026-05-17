# SmartGroups Stamp Decomposition Plan

Date: 2026-05-16

Scope: `packages/plugins/smartGroups/src/stamp.py` and tests/probes directly
needed to make that module safer. This is a technical refactor plan, not a
product PRD. User-facing behavior should remain unchanged unless a bug is
explicitly identified and documented.

## Goal

Turn `stamp.py` from a large procedural module into a small public orchestration
surface with clear internal ownership boundaries:

- naming and media matching
- cue-row parsing and cue target resolution
- timeline duration and section-extension planning
- layer mutation and result construction
- exported Designer Python entry points

The end state should make the dangerous Designer mutations easy to audit and the
pure business rules easy to test without a live Designer session.

## Non-Goals

- Do not redesign SmartGroups UX.
- Do not change package filename conventions or cue matching semantics unless a
  confirmed bug requires it.
- Do not replace Designer Python calls with frontend logic.
- Do not broaden this into a toolkit-wide refactor.
- Do not split registered Python modules until module import behavior is proven
  in the same plugin execution context.

## Starting State

`stamp.py` is still a monolith after the first de-vibecode sprint:

- roughly 1,550 lines
- roughly 60 functions
- three exported functions:
  - `execute_stamp`
  - `preview_build_packages`
  - `execute_build_packages`
- high-risk side effects concentrated in:
  - `apply_media_to_group`
  - `apply_section_extension`
  - `execute_stamp`
  - `execute_build_packages`

The first sprint added useful internal seams, but did not create true module
boundaries.

## Implementation Result

Completed on 2026-05-16 across PR-sized commits on
`codex/smartgroups-devibecode`.

Final Python module map:

- `stamp.py` - public Designer API handlers plus orchestration glue.
- `matching.py` - filename, folder, look, prefix, screen-token, and clip
  de-duplication rules.
- `cue_targets.py` - cue-row parsing, cue tag/note indexing, cue target
  resolution, duplicate package handling, and build-preview row shaping.
- `duration_planning.py` - clip duration, beat/second conversion, section
  bounds, and section-extension planning.
- `layer_mutation.py` - template group lookup, layer movement/fitting,
  existing-target detection, media assignment, layer removal, and section
  insertion mutation.

`stamp.py` is now 490 lines and exposes only the three public handlers plus
small helpers. The extracted helper modules are registered by `App.vue` before
`stamp.py` is used, following the proven `user_module_<moduleName>` import
pattern.

## Major Change Report

### Registered Module Import Safety

- Why: physical helper modules would be unsafe without knowing Designer's
  registered-module import name and registration behavior.
- Risk if left unchanged: a split could pass Vite build and then fail only
  inside Designer when `stamp.py` tried to import helpers.
- Before: module-split safety was unknown.
- After: `probe_registered_module_imports.mjs` proves helper modules must be
  explicitly registered and imported as `user_module_<moduleName>`.

### Matching Boundary

- Why: matching rules were buried in orchestration and hard to test independently
  from Designer timeline mutation.
- Risk if left unchanged: package version selection, folder filtering, and
  screen-token fallback could drift or regress invisibly.
- Before: `stamp.py` owned filename parsing, look grouping, prefix maps, and
  unique clip selection.
- After: `matching.py` owns those rules and has pure Python tests for folder
  filtering, latest screen version selection, fallback prefixes, missing-file
  filtering, and clip de-duplication.

### Cue Target Boundary

- Why: cue lookup had enough branching to deserve its own contract.
- Risk if left unchanged: real cue-indexing failures would keep appearing as
  generic "cue not found" or ambiguous matching behavior.
- Before: cue parsing, cue tag indexing, note fallback, duplicate package
  detection, and preview-row construction lived beside mutation code.
- After: `cue_targets.py` owns cue resolution and has fake-track tests for cue
  tag priority, ambiguous tags, legacy note fallback, cue-row parsing, and
  duplicate package blocking.

### Duration Planning Boundary

- Why: section-extension math should be reviewable without reading
  `insertAudioBeats` mutation code.
- Risk if left unchanged: BPM fallback behavior, clip-duration calculation, and
  block rounding could regress in a high-impact timeline path.
- Before: beat/second conversion and extension planning were interleaved with
  layer fitting and timeline insertion.
- After: `duration_planning.py` owns the pure math and has fake-track tests for
  direct conversion, BPM fallback, speed-adjusted media duration, and block
  extension planning.

### Layer Mutation Boundary

- Why: the dangerous Designer mutations needed one owner and explicit
  dependencies.
- Risk if left unchanged: media assignment, layer removal, section insertion,
  and fitting behavior remained spread through a file that also parsed cue
  sheets and filenames.
- Before: `stamp.py` directly owned template lookup, group movement, media
  assignment, layer removal, section insertion, and fitting helpers.
- After: `layer_mutation.py` owns those operations. `resourceManager` is passed
  explicitly into template-track lookup, and fake-layer tests cover movement,
  recursive fitting, existing-target detection, fitting existing layers, and
  media assignment/removal behavior.

### Public Handler Surface

- Why: exported functions should describe workflow, not every domain detail.
- Risk if left unchanged: future fixes would keep landing in the monolith and
  re-couple pure rules to Designer mutation paths.
- Before: public handlers sat below hundreds of unrelated helper lines.
- After: public signatures and TypeScript calls are unchanged, but handlers now
  coordinate named helper modules with clear responsibilities.

## Decision Gate: Python Module Split Safety

Before moving helpers into sibling `.py` files, prove import behavior in the
registered plugin module path.

### Spike

Create a tiny helper module under `packages/plugins/smartGroups/src/`, import it
from a registered module using the same loader path as the plugin, and run a
focused Designer check.

Questions to answer:

- Can `stamp.py` import a sibling plugin module after registration?
- Is the import name prefixed as `user_module_<name>` in this plugin loader
  context?
- Does the Vite Designer Python loader include sibling helper `.py` files in
  the registration payload or only explicitly imported modules?
- Does a helper module change the generated `.py.d.ts` surface or build output?

### Result

Confirmed on 2026-05-16 in a local Designer session with
`packages/knowledge-base/reference-tools/probe_registered_module_imports.mjs`.

- Registered helper modules are importable from other registered modules as
  `user_module_<moduleName>`.
- The unprefixed module name is not importable in this execution context.
- Unregistered sibling helpers are invisible to registered modules.
- The Vite Designer Python loader registers each `.py` import independently and
  does not bundle sibling helper source into a consumer module payload.

Reusable rule captured in
`packages/knowledge-base/patterns/registered-python-module-imports.md`.

### Outcomes

- Imports are safe when every helper module is explicitly imported/registered by
  the frontend before a consumer executes.
- Helper modules should avoid TypeScript-callable exports unless they are meant
  to be public. Internal Python helpers can set `__all__ = []` and still be
  importable by `stamp.py` through `user_module_<name>`.

Do not guess. This gate determines the architecture.

## Target Boundaries

### 1. Matching

Owns:

- `VIDEO_EXTENSIONS`
- `clip_stem_from_path`
- `normalize_folder`
- `clip_in_folder`
- `extract_prefix`
- `extract_screen_token`
- `parse_look_stem`
- `match_candidates`
- `collect_clip_entries`
- `collect_look_groups`
- `build_prefix_map`
- `filter_prefix_map_to_missing`
- unique clip helpers

Risks if left inside orchestration:

- frontend preview and Python execution drift
- package version selection bugs hide inside timeline code
- look filtering remains hard to test

Verification:

- pure Python tests with fake clip objects
- existing frontend matching tests remain green
- plugin build

### 2. Cue Targets

Owns:

- `normalize_package`
- `normalize_cue`
- `normalize_note`
- `cue_number_from_note`
- `expected_note_for_row`
- `parse_cue_rows`
- `package_row_map`
- `cue_note_text`
- `cue_tag_numbers`
- `build_cue_index`
- `resolve_cue_target`
- preview row construction that does not inspect layers

Risks if left inside orchestration:

- "cue not found" continues to mask real API failures
- cue tag and legacy note fallback behavior is hard to reason about
- duplicate-package handling remains scattered

Verification:

- pure Python tests for cue-row parsing and target-resolution rules
- focused Designer read-only check only if cue API behavior changes
- plugin build

### 3. Duration And Section Planning

Owns:

- `DEFAULT_SECTION_BLOCK_SECONDS`
- `clip_duration_seconds`
- `bpm_at_beat`
- beat/second conversion helpers
- `max_clip_duration_seconds`
- `section_bounds_at_beat`
- `build_section_extension_plan`

Risks if left inside mutation code:

- beat math is hard to review separately from `insertAudioBeats`
- fallback BPM behavior can drift
- section extension preview and execution can disagree

Verification:

- pure Python tests with fake track conversion methods
- no live Designer mutation unless conversion behavior changes
- plugin build

### 4. Layer Mutation

Owns:

- `is_group_layer`
- `find_template_track`
- `find_template_group`
- `move_group_to_beat`
- `collect_leaf_layers`
- existing target detection
- fitting layers to duration/end beat
- `apply_media_to_group`
- `apply_section_extension`

Risks if left inside orchestration:

- partial mutation remains difficult to inspect
- layer removal failures are swallowed in the middle of build control flow
- save/persist behavior is easy to accidentally duplicate

Verification:

- `py_compile`
- plugin build
- live Designer probe only for changed mutation behavior

### 5. Public Handlers

Owns only:

- parse exported function arguments
- load current/template resources
- call the boundary helpers
- return JSON-safe result objects

Target exported functions:

- `execute_stamp`
- `preview_build_packages`
- `execute_build_packages`

Verification:

- plugin build
- smoke check registration if module split changes
- no behavior change without a focused probe/log entry

## PR-Sized Sprint Plan

### PR 1: Import Safety Spike

Add the smallest possible helper import experiment and focused Designer probe.

Acceptance:

- plugin build passes
- probe result recorded if Designer is available
- decision recorded in this document or a follow-up note

### PR 2: Extract Matching Boundary

Move or section matching helpers and add pure tests.

Acceptance:

- no public handler behavior change
- pure matching tests cover package grouping, latest screen version, prefix
  fallback, and folder filtering
- plugin build passes

### PR 3: Extract Cue Target Boundary

Move or section cue parsing/indexing/resolution and add pure tests.

Acceptance:

- cue tags remain preferred over legacy note-prefix matching
- ambiguous cue tags keep returning blocked/skip reasons
- duplicate package behavior is unchanged
- plugin build passes

### PR 4: Extract Duration Planning

Move or section beat/second conversion and section-extension planning.

Acceptance:

- fake-track tests cover direct conversion and BPM fallback
- no `insertAudioBeats` call moves in this PR unless isolated behind the existing
  `apply_section_extension` boundary
- plugin build passes

### PR 5: Extract Layer Mutation Boundary

Move or section media assignment, removal, fitting, and ungroup behavior.

Acceptance:

- mutation functions return structured results with actionable reasons
- `except:` remains where Designer APIs require it, but failures are no longer
  silently discarded when the user can act on them
- plugin build passes
- live probe only if mutation behavior changes

### PR 6: Thin Public Handlers

Reduce exported functions to orchestration wrappers and document the final module
map.

Acceptance:

- public function signatures unchanged
- TypeScript calls unchanged
- plugin build passes
- final knowledge report states whether any Designer behavior was discovered

## Verification Matrix

Every PR:

- `npm -w packages/plugins/smartGroups run test`
- `npm -w packages/plugins/smartGroups run build`

Python-touching PRs:

- `python -m py_compile packages/plugins/smartGroups/src/stamp.py`
- include helper module paths if files are split

Designer API behavior PRs:

- read `docs/mandatory-workflow.md`
- read relevant `docs/reference.md` sections
- search KB patterns, bugs, and reference probes
- grep `packages/shared/d3.pyi` for unfamiliar method names
- run a focused probe only when behavior is new or changed
- update KB/logs if new behavior is discovered

## Rollback Strategy

Each PR should be independently revertible. Avoid commits that combine:

- pure helper movement
- behavior changes
- live Designer probe additions
- UI changes

If a split helper import fails in Designer, revert only the import-split PR and
continue with an internal-section layout inside `stamp.py`.

## Done Criteria

The decomposition is done when:

- `stamp.py` exposes only the three public handlers plus clearly necessary
  orchestration helpers, or it is internally sectioned with the same boundaries
  if physical splitting is unsafe.
- pure matching, cue target, and duration-planning rules have tests.
- mutation paths have clearer structured errors.
- build and tests pass.
- any new Designer discoveries are captured in the knowledge base.
