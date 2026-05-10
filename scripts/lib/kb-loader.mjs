/**
 * Knowledge base loader — single source of truth for hook rules.
 *
 * Scans packages/knowledge-base/{bugs,patterns,api}/*.md, parses YAML
 * frontmatter with gray-matter, validates with Zod schemas, and builds:
 *
 *   crashers[]    — flat list of regex-based crasher rules (replaces
 *                   the hardcoded CRASHERS array in check-python-safety.mjs)
 *   apiCoverage{} — map of API name → { match, patterns, required }
 *                   (replaces scripts/lib/api-coverage.mjs)
 *
 * Exports:
 *   getKB()             — returns { crashers, apiCoverage } (cached singleton)
 *   patternExists(name) — checks KB Markdown entry directories
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { KBFrontmatter } from "./schemas.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const KB_DIR = join(ROOT, "packages", "knowledge-base");
const PATTERNS_DIR = join(KB_DIR, "patterns");
const BUGS_DIR = join(KB_DIR, "bugs");
const API_DIR = join(KB_DIR, "api");

// ── Directory scanner ──────────────────────────────────────────────────────

/**
 * Scan a subdirectory of the KB for .md files with valid frontmatter.
 * @param {string} subdir - Subdirectory name (e.g. "bugs", "patterns", "api")
 * @returns {Array<{ relativePath: string, frontmatter: object }>}
 */
function scanDir(subdir) {
  const dir = join(KB_DIR, subdir);
  if (!existsSync(dir)) return [];

  const results = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;

    const filePath = join(dir, name);
    const raw = readFileSync(filePath, "utf8");
    const { data } = matter(raw);

    // Skip files without frontmatter or without the required `type` field
    if (!data || !data.type) continue;

    const parsed = KBFrontmatter.safeParse(data);
    if (!parsed.success) {
      console.error(
        `[kb-loader] Invalid frontmatter in ${subdir}/${name}:`,
        parsed.error.issues.map((i) => i.message).join(", ")
      );
      continue;
    }

    results.push({
      relativePath: `${subdir}/${name}`,
      frontmatter: parsed.data,
    });
  }

  return results;
}

// ── Loader ─────────────────────────────────────────────────────────────────

function loadKB() {
  const entries = [
    ...scanDir("bugs"),
    ...scanDir("patterns"),
    ...scanDir("api"),
  ];

  const crashers = [];
  const apiCoverage = {};

  for (const entry of entries) {
    const fm = entry.frontmatter;

    // Collect crashers
    if (fm.crashers) {
      for (const c of fm.crashers) {
        crashers.push({
          pattern: new RegExp(c.pattern),
          condition: c.condition ? new RegExp(c.condition) : undefined,
          severity: c.severity.toUpperCase(),
          message: c.message,
          doc: entry.relativePath,
        });
      }
    }

    // Collect API coverage
    if (fm.api_coverage) {
      for (const ac of fm.api_coverage) {
        apiCoverage[ac.name] = {
          match: new RegExp(ac.match),
          patterns: ac.related_files,
          required: ac.required,
        };
      }
    }
  }

  return { crashers, apiCoverage };
}

// ── Cached singleton ───────────────────────────────────────────────────────

let _cache = null;

/**
 * Get the compiled KB rules. Scans the filesystem once, then caches.
 * @returns {{ crashers: Array, apiCoverage: Object }}
 */
export function getKB() {
  if (!_cache) _cache = loadKB();
  return _cache;
}

/**
 * Force a reload of the KB (useful for tests).
 */
export function resetKB() {
  _cache = null;
}

/**
 * Check whether a Markdown entry exists in the knowledge base.
 * @param {string} filename - Filename to check in patterns/, bugs/, and api/
 * @returns {boolean}
 */
export function patternExists(filename) {
  return (
    existsSync(join(PATTERNS_DIR, filename)) ||
    existsSync(join(BUGS_DIR, filename)) ||
    existsSync(join(API_DIR, filename))
  );
}
