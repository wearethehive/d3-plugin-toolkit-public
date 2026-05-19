import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { KbIndexEntry, LoadedKb } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

interface DataPaths {
  dataRoot: string;
  kbRoot: string;
  docsRoot: string;
  indexPath: string;
}

export function loadKb(): LoadedKb {
  const paths = resolveDataPaths();
  const entries = JSON.parse(readFileSync(paths.indexPath, "utf8")) as KbIndexEntry[];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byUri = new Map(entries.map((entry) => [entry.resourceUri, entry]));

  return {
    entries,
    byId,
    byUri,
    readEntry(entry) {
      return readEntry(paths, entry);
    },
  };
}

function resolveDataPaths(): DataPaths {
  const explicitRoot = process.env.D3_KB_MCP_ROOT
    ? resolve(process.env.D3_KB_MCP_ROOT)
    : null;

  const candidates = [
    explicitRoot,
    packageRoot,
    resolve(packageRoot, ".."),
    resolve(packageRoot, "..", ".."),
  ].filter(Boolean) as string[];

  for (const dataRoot of candidates) {
    const directKb = join(dataRoot, "mcp-index.json");
    if (existsSync(directKb)) {
      return {
        dataRoot,
        kbRoot: dataRoot,
        docsRoot: join(dataRoot, "..", "docs"),
        indexPath: directKb,
      };
    }

    const packageKb = join(dataRoot, "knowledge-base", "mcp-index.json");
    if (existsSync(packageKb)) {
      return {
        dataRoot,
        kbRoot: join(dataRoot, "knowledge-base"),
        docsRoot: join(dataRoot, "docs"),
        indexPath: packageKb,
      };
    }

    const toolkitKb = join(dataRoot, "packages", "knowledge-base", "mcp-index.json");
    if (existsSync(toolkitKb)) {
      return {
        dataRoot,
        kbRoot: join(dataRoot, "packages", "knowledge-base"),
        docsRoot: join(dataRoot, "docs"),
        indexPath: toolkitKb,
      };
    }
  }

  throw new Error(
    "Could not find d3 KB MCP index. Set D3_KB_MCP_ROOT to a toolkit root or knowledge-base directory."
  );
}

function readEntry(paths: DataPaths, entry: KbIndexEntry): string {
  const candidates = [
    join(paths.dataRoot, entry.path),
    join(paths.kbRoot, entry.path.replace(/^packages\/knowledge-base\//, "")),
    join(paths.docsRoot, entry.path.replace(/^docs\//, "")),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
  }

  throw new Error(`Could not read KB entry ${entry.id} at ${entry.path}`);
}
