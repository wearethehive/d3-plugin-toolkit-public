# d3 Knowledge Base MCP

The d3 Knowledge Base MCP is a read-only Model Context Protocol server for the
curated d3-plugin-toolkit knowledge base.

It gives LLM clients a small set of retrieval handles for Designer API facts,
known crashers, and tested patterns without loading the full repository into
context.

## What It Includes

- Curated Markdown from `packages/knowledge-base/api/`
- Curated Markdown from `packages/knowledge-base/patterns/`
- Curated Markdown from `packages/knowledge-base/bugs/`
- `docs/reference.md`
- A generated compact search index at `packages/knowledge-base/mcp-index.json`

## What It Excludes

- Live Designer execution
- Probe running
- KB writes or submissions
- Raw `reference-tools/` probes
- `test-log.jsonl` and `session-log.jsonl`
- Private plugin workspaces
- Private helper code and private notes

Probe results should be promoted into canonical KB Markdown before they become
available through the MCP.

## Run From The Toolkit

From a toolkit clone:

```bash
npm install
npm run build:mcp
npm run mcp:kb
```

Most MCP clients should point at the built server directly:

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

Use the matching absolute path for your local clone.

## Run Without The Toolkit

Standalone users can run the npm package:

```bash
npx @hiveschool/d3-kb-mcp
```

The package is self-documenting:

```bash
npx @hiveschool/d3-kb-mcp --help
npx @hiveschool/d3-kb-mcp --version
```

Example MCP client config:

```json
{
  "mcpServers": {
    "d3-kb": {
      "command": "npx",
      "args": ["@hiveschool/d3-kb-mcp"]
    }
  }
}
```

### Codex Setup

From any project where you want the KB available:

```bash
codex mcp add d3-kb -- npx @hiveschool/d3-kb-mcp
codex mcp list
codex mcp get d3-kb
```

Then restart Codex or reload VS Code.

### Claude Code Setup

For Claude Code, prefer project scope so the MCP is visible to sessions opened
in that workspace:

```bash
cd C:/path/to/your-designer-plugin-project
claude mcp add --scope project d3-kb -- npx @hiveschool/d3-kb-mcp
claude mcp list
claude mcp get d3-kb
```

Then restart Claude Code or reload VS Code and run `/mcp`.

### Smoke Prompt

Use this prompt in the MCP client:

```text
Use the d3-kb MCP server. Search for "bare except" with limit 3, load
patterns/bare-except-required, get related entries for
patterns/active-context-resolution, build a context pack for safely writing
Designer Python, and read d3kb://docs/reference.
```

## Tools

### `search_kb`

Search compact KB metadata and summaries.

Useful inputs:

- `query`: API name, error phrase, behavior, or task goal
- `category`: optional `api`, `patterns`, `bugs`, or `docs`
- `status`: optional exact status filter
- `limit`: optional result limit

### `get_kb_entry`

Load one full KB entry by ID.

Example ID:

```text
patterns/bare-except-required
```

### `get_related_entries`

Return compact entries related to an existing KB entry.

### `context_pack`

Build a bounded retrieval pack for an assistant goal. This is the best starting
tool when an assistant needs just enough context before planning or coding.

## Resources

The MCP exposes stable resource URIs:

```text
d3kb://api/<slug>
d3kb://patterns/<slug>
d3kb://bugs/<slug>
d3kb://docs/reference
```

Search tools return these URIs so clients can load full Markdown only when it is
needed.

## Safety Model

The MCP is read-only. It does not prove untested API behavior, and it does not
replace the Designer probe workflow when no KB pattern exists.

If `context_pack` or `search_kb` finds no proven entry for a Designer API
behavior, treat that behavior as unproven and run a focused probe before
implementation.
