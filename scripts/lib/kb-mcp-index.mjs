/**
 * Build the read-only search index used by the KB MCP.
 *
 * The canonical knowledge remains the Markdown files. This index is a compact
 * retrieval surface for assistants so they can search before loading full
 * entries into context.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..");
export const KB_DIR = join(ROOT, "packages", "knowledge-base");
export const MCP_INDEX_PATH = join(KB_DIR, "mcp-index.json");

export const PRIVATE_MARKERS = [
  "packages/private-helpers/",
  "packages\\private-helpers\\",
  "docs/private-helper-architecture.md",
  "packages/plugins/",
  "packages\\plugins\\",
  "colour-categories",
  "cuey",
  "indirection-manager",
  "notch-keyframe-baker",
  "programming-helper",
  "smartGroups",
  "SmartGroups",
  "smartgroups",
  "smart-groups",
  "sorty",
  "timecode-switcher",
  "warpy",
  "lazyeos",
  "LazyEOS",
  "FILEY",
  "Jack_Sync",
];

const KB_CATEGORIES = ["api", "patterns", "bugs"];
const SUMMARY_LIMIT = 260;

export function containsPrivateMarker(content) {
  return PRIVATE_MARKERS.some((marker) => content.includes(marker));
}

export function buildKbMcpIndex(options = {}) {
  const root = options.root || ROOT;
  const includePrivate = Boolean(options.includePrivate);
  const entries = [];

  for (const category of KB_CATEGORIES) {
    const dir = join(root, "packages", "knowledge-base", category);
    if (!existsSync(dir)) continue;

    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".md")) continue;

      const absolutePath = join(dir, name);
      const raw = readFileSync(absolutePath, "utf8");
      if (!includePrivate && containsPrivateMarker(raw)) continue;

      entries.push(entryFromKbMarkdown(root, category, name, raw));
    }
  }

  const referencePath = join(root, "docs", "reference.md");
  if (existsSync(referencePath)) {
    entries.push(entryFromDocMarkdown(root, "reference", readFileSync(referencePath, "utf8")));
  }

  return attachRelatedIds(entries);
}

export function writeKbMcpIndex(options = {}) {
  const root = options.root || ROOT;
  const indexPath =
    options.indexPath || join(root, "packages", "knowledge-base", "mcp-index.json");
  const entries = buildKbMcpIndex({ root, includePrivate: options.includePrivate });
  writeFileSync(indexPath, JSON.stringify(entries, null, 2) + "\n", "utf8");
  return { entries, indexPath };
}

function entryFromKbMarkdown(root, category, name, raw) {
  const parsed = matter(raw);
  const slug = name.replace(/\.md$/, "");
  const id = `${category}/${slug}`;
  const path = normalizePath(relative(root, join(root, "packages", "knowledge-base", category, name)));
  const title = extractTitle(parsed.content) || titleFromSlug(slug);
  const relatedFiles = collectRelatedFiles(parsed.data);

  return {
    id,
    title,
    category,
    status: parsed.data.status || "unknown",
    testedDate: parsed.data.tested || null,
    designerVersion: parsed.data.designer_version || null,
    severity: parsed.data.severity || null,
    summary: extractSummary(parsed.content),
    tags: buildTags({ category, slug, title, frontmatter: parsed.data }),
    path,
    resourceUri: `d3kb://${category}/${slug}`,
    related: relatedFiles,
    searchText: buildSearchText(raw, parsed.data),
  };
}

function entryFromDocMarkdown(root, slug, raw) {
  const path = normalizePath(relative(root, join(root, "docs", `${slug}.md`)));
  const title = extractTitle(raw) || titleFromSlug(slug);

  return {
    id: `docs/${slug}`,
    title,
    category: "docs",
    status: "reference",
    testedDate: null,
    designerVersion: null,
    severity: null,
    summary: extractSummary(raw),
    tags: ["docs", "reference", "designer-api"],
    path,
    resourceUri: `d3kb://docs/${slug}`,
    related: [],
    searchText: buildSearchText(raw, {}),
  };
}

function attachRelatedIds(entries) {
  const byBasename = new Map();
  for (const entry of entries) {
    byBasename.set(`${basename(entry.path, ".md")}.md`, entry.id);
  }

  return entries.map((entry) => ({
    ...entry,
    related: [...new Set(entry.related)]
      .map((ref) => byBasename.get(basename(ref)) || null)
      .filter(Boolean)
      .filter((id) => id !== entry.id),
  }));
}

function collectRelatedFiles(frontmatter) {
  const related = [];
  if (Array.isArray(frontmatter.related_files)) {
    related.push(...frontmatter.related_files);
  }
  if (Array.isArray(frontmatter.api_coverage)) {
    for (const coverage of frontmatter.api_coverage) {
      if (Array.isArray(coverage.related_files)) {
        related.push(...coverage.related_files);
      }
    }
  }
  return related.filter((item) => typeof item === "string" && item.trim());
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  return match ? stripMarkdown(match[1]) : "";
}

function extractSummary(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const lines = withoutCode.split(/\r?\n/);
  const paragraphs = [];
  let current = [];
  let seenTitle = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("# ")) {
      seenTitle = true;
      continue;
    }
    if (!seenTitle) continue;
    if (!line || line.startsWith("#") || line.startsWith("|")) {
      if (current.length > 0) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      continue;
    }
    if (line.startsWith("- ") || line.match(/^\d+\.\s/)) continue;
    current.push(line);
  }

  if (current.length > 0) paragraphs.push(current.join(" "));

  const summary = paragraphs
    .map(stripMarkdown)
    .find((item) => item.length > 20);

  return clip(summary || stripMarkdown(extractTitle(markdown) || ""), SUMMARY_LIMIT);
}

function buildTags({ category, slug, title, frontmatter }) {
  const tags = new Set([category]);
  if (frontmatter.type) tags.add(String(frontmatter.type));
  if (frontmatter.status) tags.add(String(frontmatter.status));
  if (frontmatter.severity) tags.add(String(frontmatter.severity));

  for (const part of `${slug} ${title}`.split(/[^a-zA-Z0-9]+/)) {
    const lower = part.toLowerCase();
    if (lower.length >= 4) tags.add(lower);
  }

  if (Array.isArray(frontmatter.api_coverage)) {
    for (const coverage of frontmatter.api_coverage) {
      if (coverage.name) tags.add(String(coverage.name).toLowerCase());
    }
  }

  return [...tags].sort();
}

function buildSearchText(raw, frontmatter) {
  const parsed = matter(raw);
  const text = [
    parsed.content,
    JSON.stringify(frontmatter.api_coverage || []),
    JSON.stringify(frontmatter.crashers || []),
  ].join("\n");

  return stripMarkdown(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function stripMarkdown(value) {
  return String(value)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clip(value, limit) {
  if (!value || value.length <= limit) return value || "";
  return `${value.slice(0, limit - 1).trimEnd()}...`;
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}
