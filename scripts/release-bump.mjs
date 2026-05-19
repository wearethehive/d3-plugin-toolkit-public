#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const options = parseArgs(process.argv.slice(2));

main();

function main() {
  if (options.help) {
    printHelp();
    return;
  }

  const version = options._[0];
  if (!version) {
    failUsage("Missing release version.");
  }
  if (!isSemver(version)) {
    failUsage(`Invalid version: ${version}`);
  }

  section("Release Version Bump");
  console.log(`Version: ${version}`);
  console.log("");

  updateJson(resolve(ROOT, "package.json"), (json) => {
    json.version = version;
  });

  updateJson(resolve(ROOT, "packages", "kb-mcp", "package.json"), (json) => {
    json.version = version;
  });

  updateJson(resolve(ROOT, "package-lock.json"), (json) => {
    json.version = version;
    if (json.packages?.[""]) {
      json.packages[""].version = version;
    }
    if (json.packages?.["packages/kb-mcp"]) {
      json.packages["packages/kb-mcp"].version = version;
    }
  });

  console.log("");
  console.log("Version bump complete. Run `npm run release:prepare -- --npm-available` next.");
}

function updateJson(path, updater) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  updater(json);
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`updated ${path}`);
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg.startsWith("-")) {
      failUsage(`Unknown argument: ${arg}`);
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

function section(title) {
  console.log(`== ${title} ==`);
}

function printHelp() {
  console.log(`Usage: npm run release:bump -- <version>

Updates the private source version fields that drive the generated public
toolkit, standalone MCP repo, and npm package:
  - package.json
  - packages/kb-mcp/package.json
  - package-lock.json root and packages/kb-mcp entries

Example:
  npm run release:bump -- 0.1.2
`);
}

function failUsage(message) {
  console.error(message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
