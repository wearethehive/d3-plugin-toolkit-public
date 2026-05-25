# Remote Plugin Support Implementation Plan

Status: planning

This plan captures the path from the toolkit's current local-plugin orientation
to first-class support for creating, developing, testing, packaging, and
documenting remote Disguise Designer plugins.

The work should use the Orchestrated Structural Work model from
`docs/codex-workflows.md`. It touches `packages/cli`, scaffold templates,
workspace conventions, build tooling, docs, public export, and future assistant
workflow behavior.

## Current State

The toolkit is currently local-plugin shaped:

- `packages/cli/src/commands/scaffold.ts` copies `templates/plugin` into
  `packages/plugins/<name>`.
- `packages/cli/src/commands/deploy.ts` copies a built `dist/` folder into a
  Designer project `Plugins/<name>` folder.
- `scripts/vite/d3-deploy-copy.mjs` reads `.d3-toolkit.json` deploy paths and
  copies Vite build output into project plugin folders.
- `templates/plugin` assumes Designer hosts the frontend from a local project or
  common plugin folder.
- `docs/reference.md` contains the local-vs-remote distinction, but the
  LLM context library does not yet carry the full remote-plugin shape.

The repository has adjacent companion-server knowledge, especially
`packages/knowledge-base/patterns/osc-bridge-server-stdlib.md`,
`packages/knowledge-base/patterns/subprocess-from-sandbox.md`, and
`packages/knowledge-base/patterns/plugin-cef-polling.md`. Those patterns are
useful for lifecycle and diagnostics, but they are not a substitute for true
remote plugin support.

## Official Constraints To Support

From the Disguise plugin documentation:

- Designer supports local/internal plugins and remote plugins.
- Remote plugins are discovered using DNS-SD on `_d3plugin._tcp.local`.
- Remote metadata is published through DNS-SD TXT records:
  - `t=web` is required.
  - `u` is the address for web resources.
  - `s` is `requiresSession`, represented as `true` or `false`.
- The Python `designer-plugin` library can publish a plugin via DNS-SD and can
  load metadata from `d3plugin.json`.
- Remote plugins exist independently of project folders and usually require an
  installer or other explicit distribution mechanism.
- Remote plugins can include both frontend and backend components.

Sources:

- https://developer.disguise.one/plugins/configuration/index.html
- https://developer.disguise.one/plugins/architecture/
- https://developer.disguise.one/plugins/distribution/
- https://developer.disguise.one/plugins/designer-plugin/publish/
- https://developer.disguise.one/plugins/useful-links/

## Resolved Direction

- Remote plugins should live under `packages/remote-plugins/*`.
- Local plugins stay under `packages/plugins/*`.
- Support both Python and Node remote backends, but sequence the work so the
  first proven path uses Python and the official `designer-plugin` library.
- Windows-only packaging is acceptable for v1.
- A generated installer is not required for v1. A distributable folder or zip
  plus clear run/install instructions is enough for the current single-user
  workflow.

The backend sequencing matters. Python is the lower-risk first path because
Disguise documents `designer-plugin` for DNS-SD publishing and remote Designer
Python execution. Node is still worth supporting because many remote plugins
will naturally want a TypeScript/JavaScript service layer, but it should come
after the DNS-SD metadata contract is proven. Node support can either use a
Node DNS-SD implementation once validated or call a small Python publisher
sidecar that uses the official library.

## Recommended Workspace Shape

Add `packages/remote-plugins/*` to the root npm workspaces and keep local
plugins under `packages/plugins/*`.

Each plugin workspace should have an explicit toolkit manifest:

```json
{
  "kind": "remote",
  "title": "My Plugin",
  "requiresSession": true,
  "backend": "python"
}
```

Local plugins may get the same manifest later, but existing local plugins
without the manifest should remain valid for backward compatibility.

```text
packages/plugins/my-local-plugin/
packages/remote-plugins/my-remote-plugin/
```

CLI commands should branch on workspace root and manifest kind. Local remains
the default for `scaffold` unless `--type remote` is supplied. Remote commands
should refuse local-only deploy paths and expose their own dev, publish, smoke,
build, and package flows.

## Target Remote Scaffold

A remote scaffold should generate:

```text
packages/remote-plugins/my-remote-plugin/
  d3-toolkit.plugin.json
  d3plugin.json
  remote-plugin.config.json
  package.json
  README.md
  frontend/
    index.html
    src/
    vite.config.ts
  backend/
    app.py
    designer_api.py
    publisher.py
    requirements.txt
  scripts/
    dev.mjs
    smoke.mjs
    package.mjs
```

The default backend should be Python and use the official `designer-plugin`
library. A later Node backend scaffold should share the same frontend and config
contract, but use a Node service implementation. Node publishing must be proven
explicitly before it becomes the default path.

## PR-Sized Sprints

### PR 1: Remote Plugin Contract And Proof

Goal: prove the remote plugin shape before baking it into generators.

Deliverables:

- A tiny disposable remote plugin proof outside the final scaffold template.
- Confirmation that `designer-plugin` publishes DNS-SD correctly.
- Confirmation that Designer sees the plugin, reads metadata, and opens the
  frontend URL.
- Confirmation of `d3plugin.json`, `requiresSession`, `u`, `t=web`, and `s`
  behavior.
- New KB pattern for remote plugin publishing and metadata.
- Updates to `docs/reference.md` and a new remote plugin notes doc.

Acceptance:

- The proof can be run locally.
- Any unknown or version-sensitive behavior is recorded as unknown, not guessed.
- The implementation plan can move forward without unresolved TXT-record
  assumptions.

### PR 2: Workspace Kind And CLI Plumbing

Goal: make the CLI understand local vs remote plugin workspaces.

Deliverables:

- `d3-toolkit.plugin.json` manifest schema.
- Shared CLI helpers to find plugin workspaces and read the plugin kind.
- `d3 scaffold <name> --type local|remote`, with local as default.
- Root workspace update for `packages/remote-plugins/*`.
- Local-only `deploy` refuses remote plugins with a clear message.
- Unit tests for manifest reading, workspace lookup, and command branching.
- Cheat sheet update for the new `--type` option.

Acceptance:

- Existing local scaffolding remains backward compatible.
- Existing local plugins without the new manifest are treated as local until
  migrated.
- `npm run build:cli` passes.

### PR 3: Remote Scaffold Template

Goal: generate a real remote plugin skeleton.

Deliverables:

- `templates/remote-plugin/`.
- Remote `package.json` scripts.
- Vue/Vite frontend template.
- Python backend template with health endpoint.
- Python publisher using `DesignerPlugin.default_init(port)` or an equivalent
  documented constructor path.
- `d3plugin.json` and `remote-plugin.config.json`.
- Generated README with dev, publish, smoke, and packaging notes.

Acceptance:

- `npm run cli -- scaffold demo --type remote --title "Demo"` creates a
  buildable remote workspace.
- `npm install` registers the workspace.
- Generated files are ASCII-safe and do not include unproven Designer API calls.

### PR 4: Remote Dev Runner

Goal: make remote plugin development a one-command loop.

Deliverables:

- `npm run cli -- remote dev <plugin>` or equivalent.
- Starts backend, publisher, and frontend dev/build serving path.
- Prints frontend URL, backend URL, selected port, publish state, and log paths.
- Detects port conflicts and stale process hints.
- Clean shutdown behavior.

Acceptance:

- A generated remote plugin can be started with one command.
- Designer can discover the plugin when the dev runner is active.
- Failure modes are visible without needing browser DevTools.

### PR 5: Remote Designer API Layer

Goal: establish the default pattern for remote plugins to talk to Designer.

Deliverables:

- Generated backend Designer API module using `designer-plugin`.
- Example read-only Designer call.
- Example controlled command.
- Clear separation between external Python 3 backend code and Designer-executed
  Python payload code.
- Safety docs explaining when Designer Python pre-flight still applies.
- Build checks that respect `# d3-check: external-python` for backend files
  while still checking Designer payload modules where applicable.

Acceptance:

- Backend Python is not incorrectly treated as Designer sandbox Python.
- Designer-executed code still follows the mandatory Designer Python workflow.
- No raw d3 objects are returned across the remote boundary.

### PR 6: Remote Frontend Integration

Goal: make the generated frontend communicate with the backend by default.

Deliverables:

- Frontend API client for backend health and Designer status.
- In-UI diagnostics panel or status surface.
- Avoid browser-side long-lived polling as the primary backend workflow.
- Use backend events, SSE, or manual refresh where appropriate.
- Keep Live Update available for valid realtime Designer state reads.

Acceptance:

- The generated UI can show backend health and Designer connection state.
- A user can trigger the example read-only call and see the result.
- Debugging does not depend on CEF DevTools.

### PR 7: Node Backend Variant

Goal: add a first-class Node backend scaffold after the Python path has proven
the remote publishing and metadata contract.

Deliverables:

- `d3 scaffold <name> --type remote --backend node`.
- Node backend service template.
- Shared remote frontend contract with the Python template.
- Shared config schema and generated README.
- Validated publish strategy:
  - either a proven Node DNS-SD implementation, or
  - a small Python publisher sidecar using `designer-plugin`.
- Minimal Designer API client using the HTTP execution API, unless an official
  JavaScript remote plugin API becomes available.

Acceptance:

- A generated Node remote plugin can run the same basic health and Designer
  connection checks as the Python template.
- The publishing strategy is proven against Designer, not assumed from package
  names or DNS-SD theory.
- Node support does not weaken the Designer Python safety workflow for code
  executed inside Designer.

### PR 8: Remote Build And Smoke Verification

Goal: give generated remote plugins a reliable verification path.

Deliverables:

- `npm run cli -- remote build <plugin>`.
- `npm run cli -- remote smoke <plugin>`.
- Static asset checks.
- Backend health checks.
- Config and metadata validation.
- DNS-SD publish startup validation.
- Optional Designer API connectivity check when Designer is running.

Acceptance:

- A generated remote plugin has a deterministic smoke check.
- The smoke check can run without Designer for non-Designer validations.
- Designer-specific validations are clearly marked when skipped.

### PR 9: Windows Packaging Foundation

Goal: create a distributable remote plugin artifact.

Deliverables:

- Windows-first packaging path.
- Bundle frontend static assets with the backend.
- Package Python and Node backend variants into distributable folders or zips.
- Include requirements, logs path, config path, version metadata, and install
  notes.
- Document firewall, port, and hostname considerations.

Acceptance:

- A generated remote plugin can produce a distributable folder or zip.
- The artifact can be moved to another Windows machine and run after the
  documented prerequisites are installed.

### PR 10: Manual Distribution And Fresh-Machine Validation

Goal: support realistic single-user remote plugin distribution without an
installer.

Deliverables:

- Manual install and uninstall instructions.
- Fresh Windows machine validation checklist.
- Portable run scripts.
- Optional Windows shortcut/service notes, but no generated installer yet.
- Generated changelog stub.
- Compatibility metadata.
- Explicit future notes for installer generation and digital signing.

Acceptance:

- The distributable can be unpacked and run by following the generated docs.
- The remote plugin can publish itself and be discovered by Designer.
- Distribution docs match Disguise's remote plugin guidance.

### PR 11: Public Export And Context Library

Goal: make remote plugin support visible outside the private repo context.

Deliverables:

- Public export script updates.
- Generated public README updates.
- `docs/cheat-sheet.md` updates.
- `docs/codex-workflows.md` updates for remote plugin tasks.
- LLM context library export updates so future assistants know remote plugins
  are first-class.

Acceptance:

- Public export includes remote plugin docs/templates where appropriate.
- The context library contains the local-vs-remote plugin distinction and the
  new remote workflow.

### PR 12: Reference Remote Plugin

Goal: add one boring golden fixture for future remote scaffold changes.

Deliverables:

- A minimal reference remote plugin or fixture.
- Health endpoint.
- Designer connection test.
- One safe read-only Designer API call.
- One controlled command.
- Smoke test coverage.

Acceptance:

- Future changes can compare against a concrete working remote plugin.
- The example is small enough to maintain.

### PR 13: Hardening Pass

Goal: make remote support production-practical.

Deliverables:

- Port conflict diagnostics.
- Hostname override.
- DNS-SD failure handling.
- HTTPS guidance.
- Log file conventions.
- Shutdown and stale process handling.
- Packaging and signing notes.
- Compatibility and troubleshooting docs.

Acceptance:

- Common failure modes have actionable diagnostics.
- The remote plugin workflow is documented from scaffold through install.

## Deferred Decisions

These are intentionally left for later once the first remote paths are proven:

1. Should remote dev support HTTPS early, or should HTTPS wait until packaging
   and installer work?
2. When is a generated installer worth adding for wider distribution?
3. Should a future Node backend use Node DNS-SD directly, or keep a Python
   publisher sidecar indefinitely because it tracks the official Disguise
   library?

## Verification Strategy

Each PR should use the smallest meaningful verification:

- CLI and scaffold changes: `npm run build:cli` plus targeted unit tests.
- Template changes: scaffold a fresh plugin, run `npm install`, then run the
  generated build or smoke command.
- Designer behavior: run focused live Designer checks and record discoveries in
  the knowledge base.
- Packaging: test on a fresh or clean Windows environment before calling it
  complete.

## Knowledge Capture

Remote plugin support will create new confirmed knowledge. Capture it as it is
proven:

- New remote publishing pattern:
  `packages/knowledge-base/patterns/remote-plugin-publishing.md`
- New remote metadata pattern:
  `packages/knowledge-base/patterns/remote-plugin-metadata.md`
- New packaging pattern:
  `packages/knowledge-base/patterns/remote-plugin-packaging.md`
- Any crash, Designer discovery failure, or unsafe operation:
  `packages/knowledge-base/bugs/<name>.md`

Do not promote assumptions into reference docs until they are proven by a
focused check or official documentation.
