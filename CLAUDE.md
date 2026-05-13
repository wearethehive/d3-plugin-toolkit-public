# d3-plugin-toolkit

A CLI tool and monorepo framework for building Disguise Designer plugins.

## Project Structure

```
packages/cli/            - CLI tool (d3 exec, d3 test, d3 probe, d3 scaffold)
packages/shared/         - Shared library (TS types, Vue composables, Python templates)
  d3.pyi                 - Full Designer Python API stub (~60k lines) — Grep only, never read whole file
packages/knowledge-base/ - Tested patterns, known bugs, test suites
packages/plugins/        - Generated plugin workspaces
templates/plugin/        - Vue 3 + Vite plugin scaffold template
packages/knowledge-base/reference-tools/ - Proven Node.js scripts with self-documenting headers
docs/reference.md        - Full Designer API reference, Python rules, known crashers
docs/agents.md           - Agent definitions, workflow templates, evolution protocol
```

## Commands

```bash
npm run cli -- scaffold my-plugin --title "My Plugin"
npm install
npm -w packages/plugins/my-plugin run build
npm run build:cli
npm run cli -- exec "return 'hello'"
npm run cli -- exec --file script.py
npm run dev:cli -- exec "return 'hello'"
```

## New Plugin Request Protocol

If the user asks for a new Disguise plugin, use the toolkit; do not hand-create
the workspace:

1. Read `@docs/cheat-sheet.md` for current CLI usage.
2. Scaffold with `npm run cli -- scaffold <plugin-name> --title "..."`.
3. Run `npm install` so the new workspace is registered.
4. Implement Designer behavior in plugin `.py` modules with `__all__` exports
   and call them from Vue/TypeScript via `@disguise-one/designer-pythonapi`.
5. Before touching any Designer API, search `packages/knowledge-base/patterns/`,
   `packages/knowledge-base/bugs/`, and `packages/knowledge-base/reference-tools/`.
6. If the KB does not prove the behavior, run a focused probe against live
   Designer using the CLI: `npm run cli -- exec --file <probe.py>`, `npm run cli
   -- test "<expr>"`, or a test suite. Broad `npm run cli -- probe <target>
   --unsafe-dir` is for disposable sessions only.
7. Use `npm run cli -- session snapshot` before/after risky Designer changes
   and `npm run cli -- session diff` to inspect live effects.
8. Build with `npm -w packages/plugins/<plugin> run build`.
9. Promote new findings through `npm run cli -- learn` or by adding KB entries
   directly when the discovery is already confirmed.

## Non-Negotiable Pre-Flight Rules

**Before writing any Python that touches a Designer API:** Read `@docs/mandatory-workflow.md` in full.
Follow all three rules. No exceptions. No shortcuts. Guessing at API behaviour is forbidden —
if the knowledge base doesn't have a pattern, write a probe script and test it first.

**Before writing any Python that executes on Designer:** Read `@docs/reference.md` in full.
No exceptions. The crasher list exists because every item on it has destroyed a session.

**Before any multi-agent session:** Read `@docs/agents.md` to load agent definitions
and workflow templates.

**Disguise documentation is the source of truth, NOT `d3.pyi`.** Before
forming any hypothesis about what's possible with a Disguise primitive,
read the relevant guide page at `https://developer.disguise.one`. Use
`curl -sL` to fetch (`WebFetch` only sees the JS-rendered page chrome and
returns nothing useful). The flat-file index at
`https://developer.disguise.one/llms.txt` lists every documentation URL.
`d3.pyi` shows every method on every C++ class regardless of whether it's
intended for plugin use; the docs show the *intended* surface. Treating
`d3.pyi` as ground truth has cost this project entire days of dead-end
investigation. See `patterns/disguise-docs-as-source-of-truth.md`.

**Knowledge base is load-bearing:** `packages/knowledge-base/` contains tested patterns
and known bugs. Grep it before using any Designer API you haven't used in this session.

**A pre-execution hook (`scripts/check-python-safety.mjs`) automatically scans Python
for known crashers before execution.** It fires on Bash (d3 exec), Write (.py), and
Edit (.py) tool uses. If it warns you, read the linked bug doc before proceeding.

**A knowledge-base coverage hook (`scripts/check-kb-coverage.mjs`) fires on Write and
Edit of .py files.** It detects Designer API calls and checks for matching patterns or
reference tools. It blocks (exit 2) for APIs that require reading a pattern first, and
warns for uncovered APIs that need a probe script before implementation.

**Every Designer method name must exist in `d3.pyi`.** Before typing any dotted method
call on a Designer object (e.g. `track.X()`, `layer.Y()`, `cues.Z()`), grep
`packages/shared/d3.pyi` for the method name. If it does not appear as a `def`, property,
or attribute, it is invented — stop and probe. The existing hooks catch known crasher
strings and coverage gaps but cannot detect invented method names; see
`bugs/phantom-method-invented-from-plausibility.md` for the incident that motivated
this rule. A phantom-method detection hook
(`scripts/check-phantom-methods.mjs` — grep every dotted method call in the diff against
`d3.pyi` and hard-fail on zero hits) is a pending toolkit improvement.

### Knowledge Base Index

**Patterns** (tested, working code — read before implementing in that area):

| File | Use when... |
|------|-------------|
| `create-or-duplicate.md` | Creating resources (workaround for loadOrCreate crash) |
| `safe-iteration.md` | Iterating any d3 collection (REQUIRED — direct iteration crashes) |
| `indirection-setup.md` | Setting up Indirection resources, controllers, media, layer binding |
| `group-layer-creation.md` | Creating/managing GroupLayers via track.groupLayers() |
| `expression-api.md` | Driving FieldSequence values with expressions or ExpressionVariablesDevice |
| `feed-scene-config.md` | Configuring FeedScene output, mapping, deformation, heads |
| `video-input-config.md` | Accessing/configuring live video input on VideoClip resources |
| `transport-commands.md` | Playback control (play, pause, jump, speed, brightness, volume) |
| `liveupdate-subscribe.md` | Real-time WebSocket subscriptions instead of HTTP polling |
| `timeline-export-cues.md` | Accessing cues, sections, tags, notes from timeline |
| `timeline-export-keyframe-access.md` | Reading keyframe data safely (KeyFloat/KeyResource vs KeyAsKeyContainer) |
| `timeline-import-resources.md` | Loading resources by path prefix with correct type classes |
| `bare-except-required.md` | Exception handling for d3 attribute access (bare except: required) |
| `cue-removal.md` | Safe cue/section removal via removeAtTime (NEVER use .clear()) |
| `track-wipe.md` | Full track clear (layers + cues) for rebuild-from-sheet flows — preserves beat 0 (status: candidate) |
| `layer-mapping-assignment.md` | Setting layer mappings via FieldSequence.setResource |
| `transport-manager-access.md` | Locating TransportManager (guisystem.transportManager not in sandbox) |
| `timecode-transport-ltc-lifecycle.md` | Creating, configuring, and removing TimecodeTransportLtc resources |
| `osc-device-lifecycle.md` | OscDevice add/remove from DeviceManager, start/stop UDP listener |
| `sandbox-stdlib.md` | Which stdlib modules are importable in the sandbox (socket yes, threading no) |
| `layer-module-access.md` | Accessing `.module` on layers (canonical path; r32.0 removal entry RETIRED) |
| `plugin-console-debugging.md` | Plugin console output is captured by Designer's log; CEF DevTools is NOT available |
| `plugin-cef-polling.md` | CEF throttles background `fetch()` when unfocused — persist state + resume-on-mount + manual "check now" button; also OAuth token parsing that accepts access_token alone |
| `subprocess-from-sandbox.md` | Spawning external processes (companion apps, bridges) from plugin Python — `Popen` only, never blocking calls |
| `disguise-docs-as-source-of-truth.md` | Methodology rule — read Disguise developer docs before forming hypotheses from `d3.pyi` |
| `python-attribute-assignment-is-permissive.md` | Gotcha — `setattr` on `_blipValue` silently succeeds for fake attributes; always read back to verify |
| `c++-binding-non-exception-failures.md` | Gotcha — `ReflectionCallable` methods can throw errors that don't subclass `Exception`; bare `except:` required |

**Reference tools** (`reference-tools/`): 33 proven scripts (`.js` browser-side, `.py` Designer-side).
Grep filenames or contents for the API you need — each has a self-documenting header.

**When an API approach fails, search before declaring it impossible:**
1. Grep `d3.pyi` broadly — search related parent classes, not just the target class
   (e.g. for GroupLayer creation, also search Track methods)
2. Check `docs/reference.md`, `knowledge-base/patterns/`, and official Disguise docs
3. Label unresolved issues as "no working method found yet" — never "cannot be done"
4. Only escalate to the user after exhausting all four sources above

## External References

The official Disguise developer documentation is at https://developer.disguise.one.
The doc index lives at https://developer.disguise.one/llms.txt — use it to find specific pages.

**Key external resources:**
- Python API guides: `https://developer.disguise.one/python-api/guides/{topic}` — topics: audio, calibration, d3net, devices, expressions, feed, resources, stage, track-and-sequencing, transports, utility, video-input
- API changes: `https://developer.disguise.one/python-api/api-changes` — changelog across Designer versions
- Useful snippets: `https://developer.disguise.one/python-api/useful-strings`
- Plugin docs: `https://developer.disguise.one/plugins/{page}` — pages: introduction, getting-started, architecture, configuration, distribution, useful-links
- OpenAPI specs: `https://developer.disguise.one/specs/service.swagger.json`, `https://developer.disguise.one/specs/session.swagger.json`
- d3.pyi stub (latest): `https://developer.disguise.one/assets/d3.pyi`
