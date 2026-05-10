#!/usr/bin/env node

/**
 * Claude Code pre-execution hook: detects phantom Designer method calls.
 *
 * Scans outgoing Python for dotted method calls on known Designer receivers and
 * hard-fails if the method name does not appear anywhere in d3.pyi.
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { stripCommentsAndStrings } from "./lib/python-strip.mjs";
import { readStdinJson, extractPythonFromToolInput } from "./lib/python-tool-input.mjs";
import { findPhantomMethods } from "./lib/phantom-methods.mjs";

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
  const phantoms = findPhantomMethods(stripped);

  if (phantoms.length === 0) process.exit(0);

  const lines = [];
  lines.push("BLOCKED - Phantom Designer method(s) detected:");
  lines.push("");
  for (const { method, callExpr } of phantoms) {
    lines.push(`  [${callExpr}]`);
    lines.push(`    '${method}' is not found in packages/shared/d3.pyi.`);
    lines.push("    This is either a typo, a method on a different class than you think,");
    lines.push("    or an invented name. Check spelling, grep d3.pyi, or write a probe.");
    lines.push("");
  }
  lines.push("See bugs/phantom-method-invented-from-plausibility.md for context.");
  lines.push('See CLAUDE.md: "Every Designer method name must exist in d3.pyi".');

  process.stdout.write(lines.join("\n"));
  process.exit(2);
}

main();
