# d3-plugin-toolkit Cheat Sheet

All commands assume you're in the repo root (`d3-plugin-toolkit/`).

**Shorthand used below:**
- `d3` = `npm run cli --` (built CLI) or `npm run dev:cli --` (dev mode, no build needed)

---

## First-Time Setup

```bash
npm install                # install all workspace dependencies
npm run build:shared       # build the shared library
npm run build:cli          # build the CLI
```

---

## Configure Deploy Path (`.d3-toolkit.json`)

Create/edit `.d3-toolkit.json` in the **repo root** to set where plugin builds output to:

```json
{
  "deployPath": "D:/d3 Projects/MyProject/plugins"
}
```

When set, every `vite build` outputs to **both** `dist/` and `<deployPath>/<pluginName>/`.
No separate deploy step needed — `dist/` stays fresh and Designer gets the update.

To override the deploy target per-build, set the `D3_PLUGIN_OUT` env var (takes priority):

```bash
D3_PLUGIN_OUT="C:/other/path/my-plugin" npm -w packages/plugins/my-plugin run build
```

---

## Scaffold a New Plugin

```bash
npm run cli -- scaffold my-plugin
npm run cli -- scaffold my-plugin --title "My Plugin" --width 1024 --height 768
npm run cli -- scaffold my-plugin --description "Does cool stuff" --width 400 --height 300
```

Creates `packages/plugins/my-plugin/` from the template. After scaffolding:

```bash
npm install                # register the new workspace
```

---

## Build a Plugin

```bash
npm -w packages/plugins/my-plugin run build
```

Output goes to `packages/plugins/my-plugin/dist/` by default.

---

## Dev Server (Hot Reload)

```bash
npm -w packages/plugins/my-plugin run dev
```

Starts Vite dev server with hot module replacement.

---

## Deploy a Built Plugin to a Designer Project

```bash
npm run cli -- deploy my-plugin --project "D:/d3 Projects/MyProject"
```

Copies `dist/` contents to `<project>/Plugins/my-plugin/`. Build first.

---

## Execute Python on Designer

```bash
npm run cli -- exec "return d3.majorVersion"
npm run cli -- exec --file scripts/my-script.py
npm run cli -- exec "return 'hello'" --host 192.168.1.10 --port 80
```

Runs arbitrary Python against a running Designer instance.

---

## Test a Python Expression

```bash
npm run cli -- test "d3.Indirection"
npm run cli -- test "resourceManager.allResources(d3.VideoFile)" --tag video
```

Evaluates the expression, prints PASS/FAIL, and logs the result to the knowledge base.

---

## Run a Test Suite

```bash
npm run cli -- test-suite core
```

Runs all tests defined in `packages/knowledge-base/test-suites/<name>.json`.

---

## Probe / Introspect a d3 Type

```bash
npm run cli -- probe Indirection --unsafe-dir
npm run cli -- probe "guisystem.track" --all --unsafe-dir
```

Lists all properties, methods, and errors for a d3 type or live object.
`--all` includes private attributes (those starting with `_`).

Broad `dir()` probes can crash Designer on some objects, so the command refuses
to run unless `--unsafe-dir` is passed. Prefer existing focused probes in
`packages/knowledge-base/reference-tools/` or write a narrow probe and run it
with `npm run cli -- exec --file <probe.py>`.

---

## Deep-Discover a Type and Its Related Types

```bash
npm run cli -- discover Indirection
npm run cli -- discover ListIndirectionController --depth 2
```

Recursively probes a type and its related types. Results feed into `d3 learn`.

---

## Promote Findings to Knowledge Base

```bash
npm run cli -- learn
npm run cli -- learn --dry-run
```

Processes `test-log.jsonl` and creates bug docs, type docs, and updates the index.
Use `--dry-run` to preview without writing files.

---

## Capture Designer Environment Snapshot

```bash
npm run cli -- session snapshot
npm run cli -- session snapshot --label "before changes"
```

Records Designer version, project info, track state, and resource counts.

---

## Compare Snapshots (Before/After)

```bash
npm run cli -- session diff
```

Shows what changed between the last two snapshots (resource counts, layers, etc.).

---

## Common Workflows

### Start a new plugin from scratch
```bash
npm run cli -- scaffold my-plugin --title "My Plugin"
npm install
npm -w packages/plugins/my-plugin run dev
```

### Build and deploy
```bash
npm -w packages/plugins/my-plugin run build
npm run cli -- deploy my-plugin --project "D:/d3 Projects/MyProject"
```

### Build directly to Designer (skip deploy step)
Set `.d3-toolkit.json` once, then just:
```bash
npm -w packages/plugins/my-plugin run build
```

### Investigate an API before using it
```bash
npm run cli -- session snapshot --label "before"
npm run cli -- exec --file packages/knowledge-base/reference-tools/my-focused-probe.py
npm run cli -- probe SomeType --unsafe-dir
npm run cli -- discover SomeType --depth 2
npm run cli -- test "someExpression()"
npm run cli -- learn
npm run cli -- session snapshot --label "after"
npm run cli -- session diff
```

### Rebuild the CLI after making changes
```bash
npm run build:cli
```

### Use dev mode (skip CLI build)
```bash
npm run dev:cli -- exec "return 'hello'"
npm run dev:cli -- probe Indirection
```

---

## Connection Options

All commands that talk to Designer accept:

| Flag | Default | Description |
|------|---------|-------------|
| `--host <host>` | `127.0.0.1` | Designer machine IP |
| `--port <port>` | `80` | Designer HTTP API port |
| `--timeout <ms>` | `30000` | Request timeout (exec only) |
