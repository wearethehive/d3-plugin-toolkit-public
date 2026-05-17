# SmartGroups De-Vibecode Review

Date: 2026-05-16

Scope: `packages/plugins/smartGroups` only. This review intentionally avoids
whole-repository refactoring recommendations except where smartGroups directly
depends on shared toolkit behavior.

## Operating Model

Model A: Single-Agent Plugin Work.

This was a review/planning pass only. No plugin code was changed as part of the
review.

## Technical Debt

- Duplicated domain parsing exists in three places:
  `src/composables/useStamp.ts`, `src/templates.py`, and `src/stamp.py`.
  Prefix extraction, media extension stripping, look parsing, screen-token
  matching, and folder normalization can drift silently.
- `src/stamp.py` is doing too much: media matching, cue resolution, section
  extension, layer mutation, duplicate detection, preview shaping, and public
  API handlers all live in one 1,500+ line module.
- `src/App.vue` owns endpoint selection, Python module construction, dependency
  injection, folder file loading, look filtering, logging, result formatting,
  help modal UI, and tab orchestration.
- Result contracts are mostly string-shaped. Python returns dicts with
  snake_case keys, TypeScript remaps them manually, and invalid or missing
  return shapes often collapse into empty arrays or generic errors.
- `parseReturn` is duplicated in `src/App.vue` and
  `src/composables/useStamp.ts`.
- Many Designer API failures are swallowed with `except: pass`. That is
  sometimes necessary in this host, but here it also hides data loss paths,
  especially in matching, layer removal, and cue indexing.

## Architectural Concerns

- Ownership boundaries are blurry between preview logic and execution logic.
  Client-side preview uses TypeScript matching rules, Python preview uses a
  similar but separate set of rules, and execution uses another variant.
- Python module responsibility is uneven: `templates.py` contains
  `preview_stamp`, while `stamp.py` contains `execute_stamp`. That makes
  template discovery own one half of stamping behavior.
- Dependency injection via string keys in `App.vue` is brittle. Components call
  `useStampInstance()`, which depends on injected functions existing above them,
  but that contract is not typed or centralized.
- Cue sheet parsing lives inside `BuildCuesTab.vue`. This is domain logic, not
  UI logic, and it is untested.
- Generated `.py.d.ts` files expose `any` for every Python argument. That
  weakens one of the best safety nets for a plugin that mutates Designer
  timelines.

## Quick Wins

- Extract return parsing into one helper and use it from `App.vue` and
  `useStamp.ts`.
- Move TypeScript filename/look matching utilities into a small matching module
  with focused tests.
- Rename vague concepts around `lookKey`, `packageNumber`, `cueRows`,
  `prefix_map`, and `entries` into a clearer glossary.
- Move cue sheet parsing from `BuildCuesTab.vue` into a tested helper.
- Add explicit TypeScript types for injected Python functions instead of
  `(...args: unknown[])`.
- Replace empty TypeScript catch blocks with at least `lastError` or emitted
  error context where behavior is user-visible.

## Dangerous Areas

- `apply_media_to_group` mutates layer resources, renames layers, saves
  sequences, and removes unmatched layers. Risk if left unchanged: a partial
  failure can silently remove expected template layers or mask why media was not
  assigned.
- `apply_section_extension` calls `insertAudioBeats`, a high-impact timeline
  mutation. Risk if left unchanged: incorrect beat math or a swallowed exception
  can leave timeline state surprising.
- `build_cue_index` swallows almost every failure while constructing matching
  indexes. Risk if left unchanged: real Designer API failures appear as
  "cue not found," which sends debugging in the wrong direction.
- `create_template_track` uses `loadOrCreate`, which the repo rules flag as a
  call that requires care. There is existing knowledge-base material around
  template-track idempotency, so verify against that before changing behavior.
- The local endpoint override in `App.vue` is intentional but globally mutates
  shared designer state. Risk if left unchanged: future components may assume
  the launcher endpoint is respected.

## AI-Generated Or Prototype Smells

- Large god-module Python with repeated helper blocks across files.
- Broad `except: pass` guards without structured failure reporting.
- Multiple near-identical parsing and matching implementations with comments
  like "mirrors Python logic."
- UI components containing domain parsing and orchestration because it was
  faster than creating a proper boundary.
- Contract types added after the fact, but not used to validate runtime
  payloads.

## Staged Refactor Plan

### 1. Safety Baseline

Run `npm -w packages/plugins/smartGroups run build`, inspect current TypeScript
errors, and avoid Designer-mutating probes unless needed. No architecture change
yet.

### 2. Pure TypeScript Cleanup

Extract return parsing, cue-sheet parsing, and look/prefix matching into small
helpers with tests.

- Why: removes duplicated logic from components.
- Risk if left unchanged: preview and build behavior can keep drifting.
- Architecture impact: UI becomes thinner; domain parsing has one owner.

### 3. Typed Python Boundary

Define typed wrapper functions around injected Python calls and normalize
snake_case responses once.

- Why: centralizes error handling and response defaults.
- Risk if left unchanged: bad payloads silently become empty successful-looking
  states.
- Architecture impact: components consume app-level contracts, not raw Designer
  execute responses.

### 4. Conservative Python Organization

Split `stamp.py` internally into sections or helper modules only if the loader
supports it cleanly; otherwise reorganize within the file around matching, cue
indexing, section extension, layer mutation, and public handlers.

- Why: makes high-risk Designer mutations reviewable.
- Risk if left unchanged: future fixes will patch the wrong layer of
  abstraction.
- Architecture impact: same public Python API, clearer internal ownership.

### 5. Designer Mutation Hardening

Improve structured errors around layer removal, sequence assignment, ungroup,
and section extension. Keep bare `except:` where required by Designer, but
return actionable reasons.

- Why: production users need recoverable diagnostics.
- Risk if left unchanged: partial timeline mutation remains hard to diagnose.
- Architecture impact: behavior preserved, observability improved.

### 6. Verification And Knowledge Report

Build the plugin after each stage. If any Designer Python behavior is changed
or newly confirmed, run the required pre-flight/probe path and update KB/logs.
No knowledge-base update was needed for this review because no new Designer
behavior was discovered.
