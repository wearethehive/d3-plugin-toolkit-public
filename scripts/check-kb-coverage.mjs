#!/usr/bin/env node

/**
 * Claude Code pre-execution hook: checks knowledge base coverage for Designer APIs.
 *
 * Fires on Bash (d3 exec), Write (.py), and Edit (.py) tool uses.
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { stripCommentsAndStrings } from "./lib/python-strip.mjs";
import { readStdinJson, extractPythonFromToolInput } from "./lib/python-tool-input.mjs";
import { findCoverageIssues } from "./lib/safety-scan.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const input = await readStdinJson();
  if (!input) process.exit(0);

  const python = extractPythonFromToolInput(
    input.tool_name,
    input.tool_input || {},
    ROOT
  );
  if (!python) process.exit(0);

  const stripped = stripCommentsAndStrings(python);
  const { blocked, info, uncovered, unknownApis } = findCoverageIssues(stripped);

  if (blocked.length === 0 && info.length === 0 && uncovered.length === 0 && unknownApis.length === 0) {
    process.exit(0);
  }

  const lines = [];

  if (blocked.length > 0) {
    lines.push("BLOCKED - Read required knowledge base patterns before proceeding:\n");
    for (const b of blocked) {
      lines.push(`  [${b.apiName}] Read: ${b.patterns.join(", ")}`);
    }
    lines.push("");
  }

  if (info.length > 0) {
    lines.push("Knowledge base coverage available for these APIs:\n");
    for (const i of info) {
      lines.push(`  [${i.apiName}] See: ${i.patterns.join(", ")}`);
    }
    lines.push("");
  }

  if (uncovered.length > 0) {
    lines.push("WARNING - No knowledge base coverage found for:\n");
    for (const u of uncovered) {
      lines.push(`  [${u}] Write a probe script before implementing.`);
    }
    lines.push("");
  }

  if (unknownApis.length > 0) {
    lines.push("WARNING - No knowledge base coverage found for:\n");
    for (const u of unknownApis) {
      lines.push(`  [${u}] Write a probe script before implementing.`);
    }
    lines.push("");
  }

  process.stdout.write(lines.join("\n"));
  process.exit(blocked.length > 0 ? 2 : 0);
}

main();
