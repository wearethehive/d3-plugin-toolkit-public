# Public Export Workflow

This repository is the private development tree. It can contain private plugin
workspaces, local config, scratch probes, generated logs, and assistant-specific
settings. Do not publish it directly.

Use `scripts/export-public.mjs` to copy a curated toolkit surface into a
separate public repository with fresh public history.

## One-Time Public Repo Setup

Create a sibling repository next to this one:

```powershell
cd C:\Users\Rich\Documents
mkdir d3-plugin-toolkit-public
cd d3-plugin-toolkit-public
git init
git remote add origin https://github.com/wearethehive/d3-plugin-toolkit-public.git
```

The export script preserves the target repo's `.git` folder and replaces the
working tree contents around it.

## Export

From the private repo root:

```powershell
npm run export:public
```

By default this writes to:

```text
C:\Users\Rich\Documents\d3-plugin-toolkit-public
```

To choose a different target:

```powershell
npm run export:public -- --target "D:\Repos\d3-plugin-toolkit-public"
```

Preview without writing:

```powershell
npm run export:public -- --dry-run
```

If the public repo has uncommitted changes, the script stops. Commit or stash
those changes first. `--allow-dirty` exists for emergencies, but the normal
release flow should keep the public mirror clean before export.

## What Gets Exported

The script is whitelist-based. It copies:

- `packages/cli`
- `packages/shared`
- `templates/plugin`
- public build/safety scripts
- public docs
- curated knowledge-base entries
- root TypeScript, Vitest, Agent, Claude, Codex, generated README, generated
  LICENSE, and npm workspace metadata

It does not copy:

- private plugin workspaces from `packages/plugins`
- private helper capsules from `packages/private-helpers`
- private helper architecture notes such as
  `docs/private-helper-architecture.md`
- raw `packages/knowledge-base/reference-tools` probe scripts
- private legacy utility scripts
- `.claude/settings.local.json`, local settings, or `.d3-toolkit.json`
- generated logs and session JSONL files
- private Obsidian export tooling
- knowledge-base files that mention private plugin workspace names

The public export creates `packages/plugins/.gitkeep` so public users can
scaffold their own plugins into the expected workspace path.

Inherited utility scripts should not be copied into the public repository. When
they contain useful behavior, translate that behavior into canonical KB
Markdown first: facts, API surfaces, caveats, and short original examples in the
relevant topic file. Keep executable probes as small `.py` files only when they
directly validate a KB claim.

## Validate The Public Repo

After exporting:

```powershell
cd C:\Users\Rich\Documents\d3-plugin-toolkit-public
git status --short
npm run build:shared
npm run build:cli
npm test
```

For a deeper smoke test:

```powershell
npm run cli -- scaffold smoke-plugin --title "Smoke Plugin"
npm install
npm -w packages/plugins/smoke-plugin run build
```

Delete the smoke plugin before committing the public release unless you intend
to keep it as an example.

## Publish

From the public repo:

```powershell
git add .
git commit -m "Release public toolkit"
git push origin master
```

For tagged releases:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Keep release notes focused on toolkit changes, not private plugin changes.

## Safety Notes

- Never use branch filtering as the primary public-release mechanism. A branch
  that once contained private plugins can still expose them through Git history.
- Treat the public repo as generated output. Make durable source changes in the
  private repo, then export again.
- Review `git diff` in the public repo before every push.
- If a knowledge-base file is skipped because it references private plugin
  names, either leave it private or rewrite a sanitized version in the private
  repo before exporting again.
