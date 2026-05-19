#!/usr/bin/env node

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_TOOLKIT_TARGET = resolve(ROOT, "..", "d3-plugin-toolkit-public");
const DEFAULT_MCP_TARGET = resolve(ROOT, "..", "d3-plugin-toolkit-kb-mcp");

const options = parseArgs(process.argv.slice(2));
const version = options.version || readPrivateVersion();
const dryRun = Boolean(options["dry-run"]);

const repos = [
  {
    label: "private toolkit",
    cwd: ROOT,
    branch: "master",
    message: `Prepare ${version} release`,
  },
  {
    label: "public toolkit",
    cwd: resolve(options["toolkit-target"] || DEFAULT_TOOLKIT_TARGET),
    branch: "master",
    message: `Release public toolkit ${version}`,
  },
  {
    label: "standalone KB MCP",
    cwd: resolve(options["mcp-target"] || DEFAULT_MCP_TARGET),
    branch: "main",
    message: `Release KB MCP ${version}`,
  },
];

main();

function main() {
  if (options.help) {
    printHelp();
    return;
  }

  section("Release Push");
  console.log(`Version: ${version}`);
  if (dryRun) console.log("Mode: dry run");
  console.log("");

  for (const repo of repos) {
    pushRepo(repo);
  }

  console.log("");
  console.log("Release push complete.");
}

function pushRepo(repo) {
  section(repo.label);
  assertDirectory(repo.label, repo.cwd);

  const currentBranch = captureGit(["rev-parse", "--abbrev-ref", "HEAD"], repo.cwd).trim();
  if (currentBranch !== repo.branch) {
    throw new Error(`${repo.label} is on ${currentBranch}, expected ${repo.branch}: ${repo.cwd}`);
  }

  runReadOnlyGit(["status", "--short", "--branch"], repo.cwd);

  const status = captureGit(["status", "--porcelain"], repo.cwd).trim();
  if (status) {
    runReadOnlyGit(["diff", "--check"], repo.cwd);
    runGit(["add", "-A"], repo.cwd);
    runGit(["commit", "-m", repo.message], repo.cwd);
  } else {
    console.log("No local changes to commit.");
  }

  runGit(["push", "origin", repo.branch], repo.cwd);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--dry-run") {
      parsed["dry-run"] = true;
    } else if (arg === "--version") {
      parsed.version = argv[++index];
    } else if (arg.startsWith("--version=")) {
      parsed.version = arg.slice("--version=".length);
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

function readPrivateVersion() {
  const json = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  return json.version;
}

function assertDirectory(label, dir) {
  if (!existsSync(dir)) {
    throw new Error(`Missing ${label}: ${dir}`);
  }
}

function runGit(args, cwd) {
  if (dryRun) {
    console.log(`DRY-RUN ${cwd}> git ${args.map(quoteForLog).join(" ")}`);
    return;
  }

  const printable = ["git", ...args].map(quoteForLog).join(" ");
  console.log(`> ${printable}`);
  const result = spawnSync("git", args, {
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

function runReadOnlyGit(args, cwd) {
  const printable = ["git", ...args].map(quoteForLog).join(" ");
  console.log(`> ${printable}`);
  const result = spawnSync("git", args, {
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

function captureGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function quoteForLog(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function section(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

function printHelp() {
  console.log(`Usage: npm run release:push -- [options]

Commits and pushes the private source repo plus the generated public toolkit and
standalone KB MCP repos. Clean repos are pushed without creating a new commit.

Options:
  --version <version>        Override the version used in commit messages
  --toolkit-target <path>    Override generated public toolkit repo path
  --mcp-target <path>        Override generated standalone MCP repo path
  --dry-run                  Print git commands without executing them
  --help                     Show this help
`);
}

function failUsage(message) {
  console.error(message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
