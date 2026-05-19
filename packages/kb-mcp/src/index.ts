#!/usr/bin/env node

import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { buildContextPack } from "./context-pack.js";
import { loadKb } from "./kb-loader.js";
import { formatEntry, entryResourceMetadata, listResourceLinks, summarizeResults } from "./resources.js";
import { getRelatedEntries, searchEntries, toSearchResult } from "./search.js";
import type { KbCategory } from "./types.js";

const CATEGORIES = ["api", "patterns", "bugs", "docs"] as const;

const packageVersion = readPackageVersion();

handleCliArgs(process.argv.slice(2));

async function main() {
  const kb = loadKb();
  const server = new McpServer(
    {
      name: "d3-kb-mcp",
      title: "d3 Plugin Toolkit Knowledge Base",
      version: packageVersion,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  for (const entry of kb.entries) {
    server.registerResource(
      entry.id.replace(/[^a-zA-Z0-9_-]/g, "-"),
      entry.resourceUri,
      entryResourceMetadata(entry),
      async () => ({
        contents: [
          {
            uri: entry.resourceUri,
            mimeType: "text/markdown",
            text: formatEntry(entry, kb.readEntry(entry)),
          },
        ],
      })
    );
  }

  server.registerTool(
    "search_kb",
    {
      title: "Search d3 KB",
      description: "Search compact metadata from the curated d3-plugin-toolkit knowledge base.",
      inputSchema: {
        query: z.string().default("").describe("Search query, API name, warning, or implementation goal."),
        category: z.enum(CATEGORIES).optional().describe("Optional KB category filter."),
        status: z.string().optional().describe("Optional exact status filter."),
        limit: z.number().int().min(1).max(25).optional().describe("Maximum number of results."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, category, status, limit }) => {
      const results = searchEntries(kb.entries, {
        query,
        category: category as KbCategory | undefined,
        status,
        limit,
      });

      return {
        content: [
          { type: "text", text: summarizeResults(results) },
          ...listResourceLinks(kb, results),
        ],
      };
    }
  );

  server.registerTool(
    "get_kb_entry",
    {
      title: "Get d3 KB Entry",
      description: "Load one full KB entry by ID, such as patterns/bare-except-required.",
      inputSchema: {
        id: z.string().describe("Entry ID returned by search_kb."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      const entry = kb.byId.get(id);
      if (!entry) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown KB entry: ${id}` }],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: formatEntry(entry, kb.readEntry(entry)),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_related_entries",
    {
      title: "Get Related d3 KB Entries",
      description: "Return compact related KB entries for an existing entry ID.",
      inputSchema: {
        id: z.string().describe("Entry ID returned by search_kb."),
        limit: z.number().int().min(1).max(25).optional().describe("Maximum number of related entries."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, limit }) => {
      const entry = kb.byId.get(id);
      if (!entry) {
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown KB entry: ${id}` }],
        };
      }

      const results = getRelatedEntries(kb.byId, entry, limit);
      return {
        content: [
          { type: "text", text: summarizeResults(results) },
          ...listResourceLinks(kb, results),
        ],
      };
    }
  );

  server.registerTool(
    "context_pack",
    {
      title: "Build d3 KB Context Pack",
      description: "Build a bounded set of KB retrieval handles for an implementation or review goal.",
      inputSchema: {
        goal: z.string().describe("Task goal or API behavior to retrieve context for."),
        token_budget: z
          .number()
          .int()
          .min(400)
          .max(4000)
          .optional()
          .describe("Approximate maximum token budget for the compact pack."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async ({ goal, token_budget }) => {
      const pack = buildContextPack(kb, goal, token_budget);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pack, null, 2),
          },
          ...listResourceLinks(kb, pack.entries),
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function handleCliArgs(args: string[]) {
  if (args.length === 0) return;

  if (args.length === 1 && ["--help", "-h", "help"].includes(args[0])) {
    printHelp();
    process.exit(0);
  }

  if (args.length === 1 && ["--version", "-v", "version"].includes(args[0])) {
    console.log(packageVersion);
    process.exit(0);
  }

  console.error(`Unknown argument: ${args.join(" ")}`);
  console.error("Run with --help for usage.");
  process.exit(2);
}

function readPackageVersion() {
  try {
    const packageJsonUrl = new URL("../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: string };
    return packageJson.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printHelp() {
  console.log(`d3-kb-mcp ${packageVersion}

Read-only MCP server for the curated d3-plugin-toolkit knowledge base.

Usage:
  d3-kb-mcp
  npx @hiveschool/d3-kb-mcp
  d3-kb-mcp --help
  d3-kb-mcp --version

The command starts a stdio MCP server. Run it through an MCP-capable client;
running it directly will wait for JSON-RPC messages on stdin.

Codex setup:
  codex mcp add d3-kb -- npx @hiveschool/d3-kb-mcp

Claude Code setup, from the project where you want the KB available:
  claude mcp add --scope project d3-kb -- npx @hiveschool/d3-kb-mcp

Toolkit clone setup:
  node C:/path/to/d3-plugin-toolkit/packages/kb-mcp/dist/index.js

Tools:
  search_kb             Search compact KB metadata and summaries.
  get_kb_entry          Load one full KB entry by ID.
  get_related_entries   Find related curated entries for an entry ID.
  context_pack          Build a bounded retrieval pack for an assistant goal.

Resources:
  d3kb://api/<slug>
  d3kb://patterns/<slug>
  d3kb://bugs/<slug>
  d3kb://docs/reference

Smoke prompt:
  Use the d3-kb MCP server. Search for "bare except" with limit 3, load
  patterns/bare-except-required, get related entries for
  patterns/active-context-resolution, build a context pack for safely writing
  Designer Python, and read d3kb://docs/reference.
`);
}
