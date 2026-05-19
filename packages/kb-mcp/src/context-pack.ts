import type { KbIndexEntry, LoadedKb, SearchResult } from "./types.js";
import { searchEntries } from "./search.js";

const DEFAULT_TOKEN_BUDGET = 1200;
const MAX_TOKEN_BUDGET = 4000;

export interface ContextPack {
  goal: string;
  note: string;
  entries: Array<SearchResult & { keyWarnings: string[] }>;
  resourceUris: string[];
}

export function buildContextPack(
  kb: LoadedKb,
  goal: string,
  tokenBudget = DEFAULT_TOKEN_BUDGET
): ContextPack {
  const budget = Math.max(400, Math.min(MAX_TOKEN_BUDGET, Math.floor(tokenBudget)));
  const charBudget = budget * 4;
  const results = searchEntries(kb.entries, { query: goal, limit: 12 });
  const packed: ContextPack["entries"] = [];
  let used = 0;

  for (const result of results) {
    const source = kb.byId.get(result.id);
    if (!source) continue;

    const keyWarnings = warningsFor(source);
    const approximateSize =
      result.title.length + result.summary.length + keyWarnings.join(" ").length + 120;
    if (packed.length > 0 && used + approximateSize > charBudget) break;

    packed.push({ ...result, keyWarnings });
    used += approximateSize;
  }

  return {
    goal,
    note:
      packed.length > 0
        ? "Use these KB entries as retrieval handles. Load full resources when implementation details matter."
        : "No proven KB pattern matched this goal. Treat Designer API behavior as unproven and run a focused probe before implementation.",
    entries: packed,
    resourceUris: packed.map((entry) => entry.resourceUri),
  };
}

function warningsFor(entry: KbIndexEntry): string[] {
  const warnings = [];
  if (entry.severity) warnings.push(`Severity: ${entry.severity}`);
  if (entry.status && !["works", "confirmed", "documented", "observed"].includes(entry.status)) {
    warnings.push(`Status: ${entry.status}`);
  }
  if (entry.category === "bugs") warnings.push("Known bug or unsafe behavior");
  if (!entry.testedDate && entry.category !== "docs") warnings.push("No tested date in frontmatter");
  return warnings;
}
