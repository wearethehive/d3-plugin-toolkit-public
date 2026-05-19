import type { KbCategory, KbIndexEntry, SearchOptions, SearchResult } from "./types.js";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 25;

export function searchEntries(entries: KbIndexEntry[], options: SearchOptions): SearchResult[] {
  const query = normalize(options.query);
  const terms = query ? query.split(/\s+/).filter(Boolean) : [];
  const limit = clampLimit(options.limit);
  const status = options.status ? normalize(options.status) : null;

  return entries
    .filter((entry) => !options.category || entry.category === options.category)
    .filter((entry) => !status || normalize(entry.status) === status)
    .map((entry) => ({ entry, score: scoreEntry(entry, terms, query) }))
    .filter(({ score }) => score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, limit)
    .map(({ entry, score }) => toSearchResult(entry, score));
}

export function getRelatedEntries(
  entriesById: Map<string, KbIndexEntry>,
  entry: KbIndexEntry,
  limit = DEFAULT_LIMIT
): SearchResult[] {
  return entry.related
    .map((id) => entriesById.get(id))
    .filter((item): item is KbIndexEntry => Boolean(item))
    .slice(0, clampLimit(limit))
    .map((item) => toSearchResult(item, 1));
}

export function toSearchResult(entry: KbIndexEntry, score: number): SearchResult {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category as KbCategory,
    status: entry.status,
    testedDate: entry.testedDate,
    designerVersion: entry.designerVersion,
    severity: entry.severity,
    summary: entry.summary,
    tags: entry.tags,
    resourceUri: entry.resourceUri,
    score,
  };
}

function scoreEntry(entry: KbIndexEntry, terms: string[], query: string): number {
  if (terms.length === 0) return 1;

  const id = normalize(entry.id);
  const title = normalize(entry.title);
  const summary = normalize(entry.summary);
  const tags = normalize(entry.tags.join(" "));
  const searchText = normalize(entry.searchText);
  let score = 0;

  if (query && id.includes(query)) score += 16;
  if (query && title.includes(query)) score += 14;

  for (const term of terms) {
    if (id.includes(term)) score += 8;
    if (title.includes(term)) score += 6;
    if (tags.includes(term)) score += 4;
    if (summary.includes(term)) score += 3;
    if (searchText.includes(term)) score += 1;
  }

  return score;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(Number(limit))));
}
