# d3 KB MCP

Read-only MCP server for the curated d3-plugin-toolkit knowledge base.

From the public toolkit workspace:

```bash
npm install
npm run build:mcp
npm run mcp:kb
```

Standalone package users can run:

```bash
npx @hiveschool/d3-kb-mcp
```

The package includes command-line help:

```bash
npx @hiveschool/d3-kb-mcp --help
npx @hiveschool/d3-kb-mcp --version
```

The server exposes compact KB search, full entry retrieval, related-entry
lookup, bounded context packs, and stable `d3kb://` resources. It does not run
Designer, execute probes, or mutate the knowledge base.

## Install In Another Project

Use these commands from the project where you want the KB available. Users do
not need a local copy of the full toolkit.

Codex:

```bash
codex mcp add d3-kb -- npx @hiveschool/d3-kb-mcp
```

Claude Code, especially in VS Code:

```bash
claude mcp add --scope project d3-kb -- npx @hiveschool/d3-kb-mcp
```

Then restart the MCP client or reload VS Code and ask it to use `d3-kb`.

Smoke prompt:

```text
Use the d3-kb MCP server. Search for "bare except" with limit 3, load
patterns/bare-except-required, get related entries for
patterns/active-context-resolution, build a context pack for safely writing
Designer Python, and read d3kb://docs/reference.
```

Typical MCP client config for a toolkit clone:

```json
{
  "mcpServers": {
    "d3-kb": {
      "command": "node",
      "args": ["C:/path/to/d3-plugin-toolkit/packages/kb-mcp/dist/index.js"]
    }
  }
}
```
