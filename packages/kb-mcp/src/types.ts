export type KbCategory = "api" | "patterns" | "bugs" | "docs";

export interface KbIndexEntry {
  id: string;
  title: string;
  category: KbCategory;
  status: string;
  testedDate: string | null;
  designerVersion: string | null;
  severity: string | null;
  summary: string;
  tags: string[];
  path: string;
  resourceUri: string;
  related: string[];
  searchText: string;
}

export interface LoadedKb {
  entries: KbIndexEntry[];
  byId: Map<string, KbIndexEntry>;
  byUri: Map<string, KbIndexEntry>;
  readEntry(entry: KbIndexEntry): string;
}

export interface SearchOptions {
  query: string;
  category?: KbCategory;
  status?: string;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  category: KbCategory;
  status: string;
  testedDate: string | null;
  designerVersion: string | null;
  severity: string | null;
  summary: string;
  tags: string[];
  resourceUri: string;
  score: number;
}
