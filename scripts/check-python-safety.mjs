#!/usr/bin/env node

/**
 * Claude Code pre-execution hook: scans Python code for known Designer crashers.
 *
 * Fires on Bash (d3 exec), Write (.py), and Edit (.py) tool uses.
 * Exit 0 = allow with warning. Exit 2 = block.
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { readStdinJson, extractPythonFromToolInput } from "./lib/python-tool-input.mjs";
import { findCrasherWarnings } from "./lib/safety-scan.mjs";

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

  const warnings = findCrasherWarnings(python);
  if (warnings.length === 0) process.exit(0);

  const lines = [
    "KNOWN DESIGNER CRASHER DETECTED - read before proceeding:\n",
  ];
  for (const w of warnings) {
    lines.push(`[${w.severity}] ${w.message}`);
    lines.push(`  -> Details: packages/knowledge-base/${w.doc}\n`);
  }
  lines.push(
    "If you are confident this usage is safe, proceed. Otherwise, read the linked doc and use the documented workaround."
  );

  process.stdout.write(lines.join("\n"));
  process.exit(0);
}

main();
