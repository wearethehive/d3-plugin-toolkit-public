#!/usr/bin/env node

/**
 * Prepare generated public release surfaces from the private source repo.
 *
 * This intentionally stops before git commit, git push, or npm publish. Use
 * release:push and release:publish after reviewing the generated diffs.
 */

import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_TOOLKIT_TARGET = resolve(ROOT, "..", "d3-plugin-toolkit-public");
const DEFAULT_MCP_TARGET = resolve(ROOT, "..", "d3-plugin-toolkit-kb-mcp");

const options = parseArgs(process.argv.slice(2));
const toolkitTarget = resolve(options["toolkit-target"] || DEFAULT_TOOLKIT_TARGET);
const mcpTarget = resolve(options["mcp-target"] || DEFAULT_MCP_TARGET);

main();

function main() {
  if (options.help) {
    printHelp();
    return;
  }

  assertDirectory("public toolkit repo", toolkitTarget);
  assertDirectory("standalone KB MCP repo", mcpTarget);

  section("Release Prepare");
  console.log(`Private repo: ${ROOT}`);
  console.log(`Public toolkit repo: ${toolkitTarget}`);
  console.log(`Standalone MCP repo: ${mcpTarget}`);
  console.log("");

  run("git", ["status", "--short", "--branch"], ROOT);
  run("git", ["status", "--short", "--branch"], toolkitTarget);
  run("git", ["status", "--short", "--branch"], mcpTarget);

  if (!options["skip-private-checks"]) {
    section("Private Source Checks");
    runNpm(["ci"], ROOT);
    runNpm(["run", "build:shared"], ROOT);
    runNpm(["run", "build:cli"], ROOT);
    runNpm(["run", "build:mcp"], ROOT);
    runNpm(["test"], ROOT);
  }

  section("Export Generated Repos");
  const exportArgs = ["run", "export:public"];
  const exportFlags = [];
  if (options["allow-dirty"]) exportFlags.push("--allow-dirty");
  if (options["skip-export-install"]) exportFlags.push("--skip-install");
  exportFlags.push("--toolkit-target", toolkitTarget, "--mcp-target", mcpTarget);
  if (exportFlags.length > 0) exportArgs.push("--", ...exportFlags);
  runNpm(exportArgs, ROOT);

  section("Version Lockstep");
  runNpm(["run", "check:release-versions"], ROOT);

  if (options["npm-available"]) {
    runNpm(["run", "check:release-versions:npm-available"], ROOT);
  }
  if (options["npm-published"]) {
    runNpm(["run", "check:release-versions:npm-published"], ROOT);
  }

  if (!options["skip-generated-checks"]) {
    section("Public Toolkit Validation");
    runNpm(["ci"], toolkitTarget);
    runNpm(["run", "build:shared"], toolkitTarget);
    runNpm(["run", "build:cli"], toolkitTarget);
    runNpm(["run", "build:mcp"], toolkitTarget);
    runNpm(["test"], toolkitTarget);

    section("Standalone MCP Validation");
    runNpm(["ci"], mcpTarget);
    runNpm(["run", "build"], mcpTarget);
    run("node", ["dist/index.js", "--help"], mcpTarget);
    run("node", ["dist/index.js", "--version"], mcpTarget);
    if (!options["skip-pack"]) {
      runNpm(["pack", "--dry-run"], mcpTarget);
    }
  }

  section("Review Next");
  run("git", ["status", "--short", "--branch"], ROOT);
  run("git", ["status", "--short", "--branch"], toolkitTarget);
  run("git", ["status", "--short", "--branch"], mcpTarget);

  console.log("");
  console.log("Release preparation complete. Review generated diffs, then run:");
  console.log("  npm run release:push");
  console.log("  npm run release:publish");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--allow-dirty") {
      parsed["allow-dirty"] = true;
    } else if (arg === "--skip-private-checks") {
      parsed["skip-private-checks"] = true;
    } else if (arg === "--skip-generated-checks") {
      parsed["skip-generated-checks"] = true;
    } else if (arg === "--skip-export-install") {
      parsed["skip-export-install"] = true;
    } else if (arg === "--skip-pack") {
      parsed["skip-pack"] = true;
    } else if (arg === "--npm-available") {
      parsed["npm-available"] = true;
    } else if (arg === "--npm-published") {
      parsed["npm-published"] = true;
    } else if (arg === "--toolkit-target") {
      parsed["toolkit-target"] = argv[++index];
    } else if (arg.startsWith("--toolkit-target=")) {
      parsed["toolkit-target"] = arg.slice("--toolkit-target=".length);
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

function assertDirectory(label, dir) {
  if (!existsSync(dir)) {
    throw new Error(`Missing ${label}: ${dir}`);
  }
}

function runNpm(args, cwd) {
  runShell(["npm", ...args].map(quoteForShell).join(" "), cwd);
}

function run(command, args, cwd) {
  const printable = [command, ...args].map(quoteForLog).join(" ");
  console.log(`> ${printable}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runShell(command, cwd) {
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

function quoteForLog(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function section(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function printHelp() {
  console.log(`Usage: npm run release:build -- [options]

Alias: npm run release:prepare -- [options]

Runs the private-to-public release preparation flow:
  1. Private npm ci/build/test
  2. Export public toolkit and standalone KB MCP repos
  3. Version lockstep check
  4. Public toolkit npm ci/build/test
  5. Standalone MCP npm ci/build/help/version/npm-pack dry-run

The script does not commit, push, tag, or publish.

Options:
  --allow-dirty              Pass through to export when generated repos are already dirty
  --npm-available            Confirm target npm version is not already published
  --npm-published            Confirm npm registry matches the source version
  --toolkit-target <path>    Override generated public toolkit repo path
  --mcp-target <path>        Override generated standalone MCP repo path
  --skip-private-checks      Skip private install/build/test
  --skip-generated-checks    Skip generated repo build/test validation
  --skip-export-install      Pass --skip-install to export-public
  --skip-pack                Skip npm pack --dry-run in standalone MCP repo
  --help                     Show this help
`);
}

function failUsage(message) {
  console.error(message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
