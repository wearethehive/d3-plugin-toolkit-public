# d3-plugin-toolkit

Toolkit for building local Disguise Designer plugins with Vue 3, Vite, TypeScript, and Designer Python safety checks.

This public repository contains the toolkit, shared utilities, scaffold template, documentation, and curated knowledge base. It does not contain private plugin workspaces.

## Requirements

- Node.js 18 or newer
- npm
- Disguise Designer for live API execution and plugin testing
- Python available as `python3` when building plugins that use `@disguise-one/designer-pythonapi`

## Setup

```bash
npm install
npm run build:shared
npm run build:cli
npm test
```

## Create a Plugin

```bash
npm run cli -- scaffold my-plugin --title "My Plugin"
npm install
npm -w packages/plugins/my-plugin run dev
```

Build the plugin for Designer:

```bash
npm -w packages/plugins/my-plugin run build
```

The build output goes to `packages/plugins/my-plugin/dist/`. Copy that folder into a Designer project plugin folder, or configure `.d3-toolkit.json` as described in `docs/cheat-sheet.md`.

## Designer Python Safety

Designer's Python API can crash the host application when called incorrectly. Before changing Designer Python, read:

- `docs/mandatory-workflow.md`
- `docs/reference.md`
- `packages/knowledge-base/README.md`

Use the local knowledge base and focused probes before relying on unfamiliar Designer API behavior.
