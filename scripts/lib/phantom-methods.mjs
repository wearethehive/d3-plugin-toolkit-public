/**
 * Phantom Designer method detection.
 *
 * Checks dotted method calls on canonical Designer receiver names against the
 * token set in packages/shared/d3.pyi. This is a heuristic: it catches invented
 * method names without pretending to be full Python type analysis.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DEFAULT_D3_PYI = join(ROOT, "packages", "shared", "d3.pyi");

export const DESIGNER_ROOTS = [
  "track",
  "guisystem",
  "resourceManager",
  "deviceManager",
  "layer",
  "module",
  "stage",
  "cues",
  "cue",
  "sequence",
  "section",
  "mapping",
  "controller",
  "indirection",
  "device",
  "transport",
  "player",
];

export const STDLIB_METHOD_ALLOWLIST = new Set([
  "strip", "rstrip", "lstrip", "split", "rsplit", "splitlines",
  "join", "replace", "startswith", "endswith", "lower", "upper",
  "capitalize", "title", "encode", "decode", "format",
  "count", "index", "find", "rfind", "isdigit", "isalpha",
  "isspace", "isalnum", "isnumeric", "zfill", "ljust", "rjust", "center",
  "append", "extend", "insert", "pop", "remove", "clear",
  "keys", "values", "items", "get", "update", "setdefault",
  "add", "discard", "union", "intersection", "difference",
  "copy", "sort", "reverse",
  "bit_length", "to_bytes", "from_bytes",
  "__init__", "__str__", "__repr__", "__len__",
  "__iter__", "__next__", "__getitem__", "__setitem__",
  "__contains__", "__hash__", "__enter__", "__exit__",
  "__eq__", "__ne__", "__lt__", "__gt__", "__le__", "__ge__",
  "read", "write", "readline", "readlines", "close", "flush", "seek", "tell",
]);

const tokenCache = new Map();

export function getPyiTokens(pyiPath = DEFAULT_D3_PYI) {
  if (tokenCache.has(pyiPath)) return tokenCache.get(pyiPath);
  if (!existsSync(pyiPath)) {
    tokenCache.set(pyiPath, null);
    return null;
  }
  const text = readFileSync(pyiPath, "utf8");
  const tokens = new Set(text.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) || []);
  tokenCache.set(pyiPath, tokens);
  return tokens;
}

export function findPhantomMethods(stripped, opts = {}) {
  const tokens = opts.tokens || getPyiTokens(opts.pyiPath);
  if (!tokens) return [];

  const roots = opts.roots || DESIGNER_ROOTS;
  const allowlist = opts.allowlist || STDLIB_METHOD_ALLOWLIST;
  const rootGroup = roots.join("|");
  const re = new RegExp(`\\b(${rootGroup})((?:\\.\\w+)*)\\.(\\w+)\\s*\\(`, "g");
  const phantoms = [];
  const seen = new Set();

  let m;
  while ((m = re.exec(stripped)) !== null) {
    const method = m[3];
    if (allowlist.has(method)) continue;
    if (tokens.has(method)) continue;

    const callExpr = `${m[1]}${m[2]}.${method}()`;
    if (seen.has(callExpr)) continue;
    seen.add(callExpr);
    phantoms.push({ method, callExpr });
  }

  return phantoms;
}

