# d3-plugin-toolkit

![d3 Plugin Toolkit Workflow](docs/assets/d3-plugin-toolkit-workflow.png)

Toolkit for building local Disguise Designer plugins with Vue 3, Vite, TypeScript, and Designer Python safety checks.

This public repository contains the toolkit, shared utilities, scaffold template, documentation, and curated knowledge base. It does not contain private plugin workspaces.

## Requirements

- Node.js 18 or newer
- npm
- Disguise Designer for live API execution and plugin testing
- Python available as `python3` when building plugins that use `@disguise-one/designer-pythonapi`

## First-Time Quick Start

Run these commands from the toolkit root folder, the folder that contains this
`package.json` file. For example, after unzipping the toolkit:

```powershell
cd C:\path\to\d3-plugin-toolkit-public
```

Install dependencies and build the toolkit CLI:

```bash
npm install
npm run build:shared
npm run build:cli
```

Then create your first plugin:

```bash
npm run cli -- scaffold my-plugin --title "My Plugin"
npm install
npm -w packages/plugins/my-plugin run dev
```

The scaffold command creates `packages/plugins/my-plugin/` inside this toolkit
workspace. Run the second `npm install` after scaffolding so npm registers the
new plugin workspace.

Optional toolkit check:

```bash
npm test
```

### If `npm run cli` cannot find `packages/cli/dist/index.js`

That means the CLI has not been built yet, or the command was run from outside
the toolkit root. Run `npm run build:shared` and `npm run build:cli` from the
toolkit root, then retry the scaffold command.

## Build a Plugin

Build the plugin for Designer:

```bash
npm -w packages/plugins/my-plugin run build
```

The build output goes to `packages/plugins/my-plugin/dist/`. Copy that folder into a Designer project plugin folder, or configure `.d3-toolkit.json` as described in `docs/cheat-sheet.md`.

## Configure Designer Deploy Path

For the smoothest local workflow, create `.d3-toolkit.json` in the repo root and point it at the `plugins` folder inside your Designer project:

```json
{
  "deployPath": "D:/d3 Projects/MyProject/plugins"
}
```

Once this is set, each plugin build writes to both locations:

- `packages/plugins/my-plugin/dist/`
- `D:/d3 Projects/MyProject/plugins/my-plugin/`

That means you can usually build and then reload the plugin in Designer:

```bash
npm -w packages/plugins/my-plugin run build
```

For a one-off deploy without `.d3-toolkit.json`, build first and then copy the built plugin into a Designer project:

```bash
npm -w packages/plugins/my-plugin run build
npm run cli -- deploy my-plugin --project "D:/d3 Projects/MyProject"
```

The manual deploy command copies to `<project>/Plugins/my-plugin/`. See `docs/cheat-sheet.md` for more deployment options, including the `D3_PLUGIN_OUT` per-build override.

## Suggested Starting Prompt

When working with an AI coding assistant in this repo, paste a prompt like this
at the start of the session:

```text
You are helping me build a Disguise Designer plugin with d3-plugin-toolkit.

First inspect this repo and read the assistant workflow files that apply to you:
AGENTS.md and docs/codex-workflows.md for Codex, or CLAUDE.md and .claude/
for Claude Code. Also read docs/cheat-sheet.md before assuming CLI commands.

Do not require me to know the repo structure. If I describe a plugin in plain
language, choose a sensible plugin slug/title, scaffold it with:

npm run cli -- scaffold <plugin-name> --title "<Plugin Title>"

Then run npm install so the new workspace is registered. Keep UI code in
Vue/TypeScript, keep Designer behavior in plugin .py modules with __all__
exports, and call those Python modules through the existing Designer Python API
integration. Preserve Vite's Designer assumptions, including base: './' and
single-chunk output.

Before writing or changing any Python that touches Designer, do the safety
pre-flight: read docs/mandatory-workflow.md, read the relevant docs/reference.md
sections, search packages/knowledge-base for proven patterns and known bugs, and
grep packages/shared/d3.pyi only to confirm method/property names. Do not invent
Designer API names. If behavior is not proven, write and run a focused probe or
test through the CLI before implementing.

Remember that Designer Python is Python 2.7: no f-strings. Put import d3 inside
function bodies for registered plugin modules, use the injected resourceManager
global, use bare except: around Designer API calls, avoid direct iteration of
unknown d3 proxy collections, and return JSON-safe values to TypeScript.

Verify with the smallest meaningful command: npm -w packages/plugins/<plugin>
run build for plugin work; npm run build:cli, npm run build:shared, or npm test
for toolkit/shared changes; and CLI probes/tests/session snapshots for live
Designer behavior when available. If Designer is unavailable, say exactly what
could not be verified.

Finish with what changed, which files were touched, how I can test it, and any
verification gaps.
```

## Designer Python Safety

Designer's Python API can crash the host application when called incorrectly. Before changing Designer Python, read:

- `docs/mandatory-workflow.md`
- `docs/reference.md`
- `packages/knowledge-base/README.md`

Use the local knowledge base and focused probes before relying on unfamiliar Designer API behavior.

Useful live Designer commands:

- `npm run cli -- session snapshot --label "before"`
- `npm run cli -- exec --file <probe.py>`
- `npm run cli -- test "<expr>"`
- `npm run cli -- test-suite <name>`
- `npm run cli -- learn`

Broad `npm run cli -- probe <target> --unsafe-dir` is available for disposable
sessions, but focused probes and KB patterns are preferred.

## Community Submissions

The community probe submission portal is coming soon. For now, share findings through GitHub issues or direct maintainer review.

## License

This project is source-available, not open source under an OSI-approved license.
You may use the toolkit for free to build your own Disguise Designer plugins,
including plugins you use or distribute, but you may not sell, repackage,
redistribute, or offer the toolkit itself as a competing product or service
without written permission. See `LICENSE`.

## Assistant Workflows

This repository includes assistant-facing workflow files because they are part
of the toolkit's safety model:

- `AGENTS.md` and `docs/codex-workflows.md` for Codex
- `CLAUDE.md`, `.claude/settings.json`, and `.claude/commands/` for Claude Code
- `.codex/hooks.json` for Codex hook parity where supported
