#!/usr/bin/env node

/**
 * Generates packages/knowledge-base/api/index.json from KB frontmatter.
 *
 * Replaces manual index maintenance. Run after adding/editing KB files:
 *   node scripts/generate-index.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KB_DIR = join(ROOT, "packages", "knowledge-base");
const INDEX_PATH = join(KB_DIR, "api", "index.json");

function scanDir(subdir) {
  const dir = join(KB_DIR, subdir);
  if (!existsSync(dir)) return [];

  const results = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const raw = readFileSync(join(dir, name), "utf8");
    const { data } = matter(raw);
    if (!data || !data.type) continue;

    const entry = {
      file: `${subdir}/${name}`,
      status: data.status || "unknown",
    };

    if (data.type === "bug") {
      entry.bug = name.replace(".md", "");
      if (data.severity) entry.severity = data.severity;
    } else if (data.type === "pattern") {
      entry.pattern = name.replace(".md", "");
    } else if (data.type === "api") {
      entry.object = name.replace(".md", "");
    }

    if (data.tested) entry.testedDate = data.tested;
    if (data.designer_version) entry.designerVersion = data.designer_version;

    results.push(entry);
  }

  return results;
}

const entries = [
  ...scanDir("api"),
  ...scanDir("patterns"),
  ...scanDir("bugs"),
];

writeFileSync(INDEX_PATH, JSON.stringify(entries, null, 2) + "\n");
console.log(`Generated ${INDEX_PATH} with ${entries.length} entries.`);
