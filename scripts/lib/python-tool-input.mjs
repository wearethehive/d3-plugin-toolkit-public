/**
 * Shared helpers for Claude/Codex hook-style tool input.
 *
 * The hook scripts receive JSON on stdin that identifies a tool name and its
 * input. This module extracts outgoing Python consistently so safety checks do
 * not drift between pre-execution hooks and build-time checks.
 */

import { readFileSync } from "fs";
import { join } from "path";

export function readStdinJson() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(buf));
      } catch {
        resolve(null);
      }
    });
  });
}

export function extractPythonFromToolInput(toolName, toolInput = {}, rootDir = process.cwd()) {
  if (toolName === "Bash") {
    const cmd = toolInput.command || "";
    if (!/\bexec\b/.test(cmd)) return null;
    if (!/d3|cli/.test(cmd)) return null;

    const fileMatch = cmd.match(/--file\s+["']?([^\s"']+)/);
    if (fileMatch) {
      try {
        return readFileSync(join(rootDir, fileMatch[1]), "utf8");
      } catch {
        return null;
      }
    }

    const inlineMatch =
      cmd.match(/exec\s+["'](.+?)["']\s*$/s) ||
      cmd.match(/exec\s+["']([\s\S]+?)["']/s);
    if (inlineMatch) return inlineMatch[1];

    const heredocMatch = cmd.match(/exec\s+.*<<['"]?(\w+)['"]?\n([\s\S]*?)\n\1/);
    if (heredocMatch) return heredocMatch[2];

    return null;
  }

  if (toolName === "Write") {
    const path = toolInput.file_path || "";
    if (!path.endsWith(".py")) return null;
    return toolInput.content || null;
  }

  if (toolName === "Edit") {
    const path = toolInput.file_path || "";
    if (!path.endsWith(".py")) return null;
    return toolInput.new_string || null;
  }

  return null;
}

