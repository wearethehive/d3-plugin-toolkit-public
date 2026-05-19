import type { KbIndexEntry, LoadedKb, SearchResult } from "./types.js";

export function entryResourceMetadata(entry: KbIndexEntry) {
  return {
    title: entry.title,
    description: `${entry.category} / ${entry.status}: ${entry.summary}`,
    mimeType: "text/markdown",
  };
}

export function formatEntry(entry: KbIndexEntry, markdown: string): string {
  const metadata = [
    `ID: ${entry.id}`,
    `Category: ${entry.category}`,
    `Status: ${entry.status}`,
    entry.testedDate ? `Tested: ${entry.testedDate}` : null,
    entry.designerVersion ? `Designer Version: ${entry.designerVersion}` : null,
    entry.severity ? `Severity: ${entry.severity}` : null,
    `Resource URI: ${entry.resourceUri}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${metadata}\n\n${markdown}`;
}

export function summarizeResults(results: SearchResult[]): string {
  if (results.length === 0) return "[]";
  return JSON.stringify(results, null, 2);
}

export function listResourceLinks(kb: LoadedKb, results: SearchResult[]) {
  return results
    .map((result) => kb.byId.get(result.id))
    .filter((entry): entry is KbIndexEntry => Boolean(entry))
    .map((entry) => ({
      type: "resource_link" as const,
      uri: entry.resourceUri,
      name: entry.title,
      description: entry.summary,
      mimeType: "text/markdown",
    }));
}
