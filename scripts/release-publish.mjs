#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MCP_TARGET = resolve(ROOT, "..", "d3-plugin-toolkit-kb-mcp");

const options = parseArgs(process.argv.slice(2));
const mcpTarget = resolve(options["mcp-target"] || DEFAULT_MCP_TARGET);
const dryRun = Boolean(options["dry-run"]);

main();

function main() {
  if (options.help) {
    printHelp();
    return;
  }

  assertDirectory("standalone KB MCP repo", mcpTarget);

  section("Release Publish");
  console.log(`Version: ${readPrivateVersion()}`);
  console.log(`Standalone MCP repo: ${mcpTarget}`);
  if (dryRun) console.log("Mode: dry run");
  console.log("");

  runNpm(["run", "check:release-versions:npm-available"], ROOT);
  runNpm(["whoami"], mcpTarget);
  runNpm(["publish", "--access", "public"], mcpTarget);
  runNpm(["run", "check:release-versions:npm-published"], ROOT);

  console.log("");
  console.log("Release publish complete.");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed["dry-run"] = true;
    } else if (arg === "--mcp-target") {
      parsed["mcp-target"] = argv[++index];
    } else if (arg.startsWith("--mcp-target=")) {
      parsed["mcp-target"] = arg.slice("--mcp-target=".length);
    } else {
      failUsage(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function readPrivateVersion() {
  const json = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  return json.version;
}

function assertDirectory(label, dir) {
  if (!existsSync(dir)) {
    throw new Error(`Missing ${label}: ${dir}`);
  }
}

function runNpm(args, cwd) {
  runShell(["npm", ...args].map(quoteForShell).join(" "), cwd);
}

function runShell(command, cwd) {
  if (dryRun) {
    console.log(`DRY-RUN ${cwd}> ${command}`);
    return;
  }

  console.log(`> ${command}`);
  const result = spawnSync(command, {
    cwd,
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function quoteForShell(value) {
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function section(title) {
  console.log(`== ${title} ==`);
}

function printHelp() {
  console.log(`Usage: npm run release:publish -- [options]

Publishes the standalone KB MCP package to npm, then verifies the npm registry
matches the private source version.

Run this only after:
  npm run release:bump -- <version>
  npm run release:build -- --npm-available
  npm run release:push

Options:
  --mcp-target <path>        Override generated standalone MCP repo path
  --dry-run                  Print npm commands without executing them
  --help                     Show this help
`);
}

function failUsage(message) {
  console.error(message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
