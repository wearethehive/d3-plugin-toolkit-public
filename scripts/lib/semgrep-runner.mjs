/**
 * Semgrep runner for AST-aware Python pattern matching.
 *
 * Provides an alternative to regex-based crasher detection. Semgrep does not
 * run natively on Windows — this module shells out to WSL2. If WSL/Semgrep
 * are unavailable, the caller falls back to regex matching.
 *
 * Exports:
 *   semgrepAvailable() — checks if WSL + Semgrep are installed (cached)
 *   runSemgrep(python)  — writes Python to temp file, runs Semgrep, returns warnings
 */

import { writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const RULES_DIR = join(ROOT, "packages", "knowledge-base", "semgrep-rules");

// ── Availability check ─────────────────────────────────────────────────────

let _available = null;

/**
 * Check if WSL and Semgrep are available. Result is cached.
 * @returns {boolean}
 */
export function semgrepAvailable() {
  if (_available !== null) return _available;

  try {
    execSync("wsl which semgrep", { stdio: "pipe", timeout: 5000 });
    _available = true;
  } catch {
    _available = false;
  }

  return _available;
}

// ── Path conversion ────────────────────────────────────────────────────────

/**
 * Convert a Windows path to a WSL path.
 * C:\Users\foo\bar → /mnt/c/Users/foo/bar
 */
function toWslPath(winPath) {
  return winPath
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`)
    .replace(/\\/g, "/");
}

// ── Runner ─────────────────────────────────────────────────────────────────

/**
 * Run Semgrep against a Python code string and return warnings.
 *
 * @param {string} python - Python source code to scan
 * @returns {Array<{ severity: string, message: string, doc: string }>}
 */
export function runSemgrep(python) {
  const tmpName = `d3_safety_${randomBytes(4).toString("hex")}.py`;
  const tmpPath = join(tmpdir(), tmpName);

  try {
    writeFileSync(tmpPath, python, "utf8");

    const wslTmpPath = toWslPath(tmpPath);
    const wslRulesDir = toWslPath(RULES_DIR);

    const result = execSync(
      `wsl semgrep --config "${wslRulesDir}" --json --no-git-ignore "${wslTmpPath}"`,
      { stdio: "pipe", timeout: 10000, encoding: "utf8" }
    );

    const output = JSON.parse(result);
    const warnings = [];

    for (const finding of output.results || []) {
      const meta = finding.extra?.metadata || {};
      warnings.push({
        severity: (meta["kb-severity"] || "WARN").toUpperCase(),
        message: finding.extra?.message || finding.check_id,
        doc: meta.doc || finding.check_id,
      });
    }

    return warnings;
  } catch (err) {
    // Semgrep exits non-zero when it finds results AND on errors.
    // Try parsing stdout as JSON anyway.
    if (err.stdout) {
      try {
        const output = JSON.parse(err.stdout);
        const warnings = [];
        for (const finding of output.results || []) {
          const meta = finding.extra?.metadata || {};
          warnings.push({
            severity: (meta["kb-severity"] || "WARN").toUpperCase(),
            message: finding.extra?.message || finding.check_id,
            doc: meta.doc || finding.check_id,
          });
        }
        return warnings;
      } catch {
        // JSON parse failed — real error
      }
    }

    // Semgrep failed entirely — return empty, caller will fall back to regex
    return [];
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // cleanup failure is non-critical
    }
  }
}
