#!/usr/bin/env node

/**
 * Verify release version lockstep across the private source repo, generated
 * public toolkit repo, standalone KB MCP repo, and optionally npm.
 */

import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_PUBLIC_DIR = resolve(ROOT, "..", "d3-plugin-toolkit-public");
const DEFAULT_MCP_DIR = resolve(ROOT, "..", "d3-plugin-toolkit-kb-mcp");
const VALID_NPM_MODES = new Set(["skip", "published", "available"]);

const options = parseArgs(process.argv.slice(2));
const publicDir = resolveOption(options["public-dir"], DEFAULT_PUBLIC_DIR);
const mcpDir = resolveOption(options["mcp-dir"], DEFAULT_MCP_DIR);
const npmMode = options["npm-mode"] || "skip";

if (!VALID_NPM_MODES.has(npmMode)) {
  failUsage(`Invalid --npm-mode value: ${npmMode}`);
}

const results = [];

const sourcePackagePath = join(ROOT, "package.json");
const sourceVersion = readVersion(sourcePackagePath, "version");
if (!sourceVersion) {
  addResult("ERROR", "private root package", "missing", sourcePackagePath, "source version is required");
  printReport();
  process.exit(1);
}
addResult("OK", "private root package", sourceVersion, sourcePackagePath, "");

const packageName = readJson(join(ROOT, "packages", "kb-mcp", "package.json")).name;

checkVersion("private package-lock root", join(ROOT, "package-lock.json"), "version");
checkVersion("private package-lock workspace root", join(ROOT, "package-lock.json"), [
  "packages",
  "",
  "version",
]);
checkVersion(
  "private packages/kb-mcp package",
  join(ROOT, "packages", "kb-mcp", "package.json"),
  "version"
);
checkVersion("private package-lock packages/kb-mcp", join(ROOT, "package-lock.json"), [
  "packages",
  "packages/kb-mcp",
  "version",
]);

checkTargetRepo("public toolkit", publicDir, Boolean(options["require-public"]), () => {
  checkVersion("public root package", join(publicDir, "package.json"), "version");
  checkVersion("public package-lock root", join(publicDir, "package-lock.json"), "version");
  checkVersion("public package-lock workspace root", join(publicDir, "package-lock.json"), [
    "packages",
    "",
    "version",
  ]);
  checkVersion(
    "public packages/kb-mcp package",
    join(publicDir, "packages", "kb-mcp", "package.json"),
    "version"
  );
  checkVersion("public package-lock packages/kb-mcp", join(publicDir, "package-lock.json"), [
    "packages",
    "packages/kb-mcp",
    "version",
  ]);
});

checkTargetRepo("standalone KB MCP", mcpDir, Boolean(options["require-mcp"]), () => {
  checkVersion("standalone package", join(mcpDir, "package.json"), "version");
  checkVersion("standalone package-lock root", join(mcpDir, "package-lock.json"), "version");
  checkVersion("standalone package-lock workspace root", join(mcpDir, "package-lock.json"), [
    "packages",
    "",
    "version",
  ]);
});

if (npmMode !== "skip") {
  checkNpmVersion(packageName, npmMode);
}

printReport();

if (results.some((result) => result.status === "ERROR")) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--public-dir") {
      parsed["public-dir"] = argv[++index];
    } else if (arg.startsWith("--public-dir=")) {
      parsed["public-dir"] = arg.slice("--public-dir=".length);
    } else if (arg === "--mcp-dir") {
      parsed["mcp-dir"] = argv[++index];
    } else if (arg.startsWith("--mcp-dir=")) {
      parsed["mcp-dir"] = arg.slice("--mcp-dir=".length);
    } else if (arg === "--require-public") {
      parsed["require-public"] = true;
    } else if (arg === "--require-mcp") {
      parsed["require-mcp"] = true;
    } else if (arg === "--npm") {
      parsed["npm-mode"] = "published";
    } else if (arg === "--npm-published") {
      parsed["npm-mode"] = "published";
    } else if (arg === "--npm-available") {
      parsed["npm-mode"] = "available";
    } else if (arg === "--npm-mode") {
      parsed["npm-mode"] = argv[++index];
    } else if (arg.startsWith("--npm-mode=")) {
      parsed["npm-mode"] = arg.slice("--npm-mode=".length);
    } else {
      failUsage(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function resolveOption(value, fallback) {
  return resolve(value || fallback);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function checkVersion(label, filePath, pathSpec) {
  if (!existsSync(filePath)) {
    addResult("ERROR", label, "missing", filePath, "expected release metadata file");
    return;
  }

  const version = readVersion(filePath, pathSpec);
  if (!version) {
    addResult("ERROR", label, "missing", filePath, "version field not found");
    return;
  }

  addVersionResult(label, version, filePath);
}

function readVersion(filePath, pathSpec) {
  if (!existsSync(filePath)) return null;
  const json = readJson(filePath);
  const parts = Array.isArray(pathSpec) ? pathSpec : [pathSpec];
  let value = json;
  for (const part of parts) {
    if (!value || typeof value !== "object" || !(part in value)) return null;
    value = value[part];
  }
  return typeof value === "string" && value.length > 0 ? value : null;
}

function addVersionResult(label, version, filePath) {
  if (version === sourceVersion) {
    addResult("OK", label, version, filePath, "");
    return;
  }
  addResult("ERROR", label, version, filePath, `expected ${sourceVersion}`);
}

function checkTargetRepo(label, dir, required, callback) {
  if (!existsSync(dir)) {
    addResult(
      required ? "ERROR" : "WARN",
      label,
      "missing",
      dir,
      required ? "required target repo is missing" : "target repo not present; skipping"
    );
    return;
  }
  callback();
}

function checkNpmVersion(name, mode) {
  const registryVersion = getNpmVersion(name);

  if (mode === "published") {
    if (!registryVersion) {
      addResult("ERROR", "npm registry", "missing", name, "package/version not published");
      return;
    }
    addVersionResult("npm registry", registryVersion, name);
    return;
  }

  if (!registryVersion) {
    addResult("OK", "npm registry availability", "not published", name, sourceVersion);
    return;
  }

  if (registryVersion === sourceVersion) {
    addResult(
      "ERROR",
      "npm registry availability",
      registryVersion,
      name,
      "target version is already published"
    );
    return;
  }

  addResult(
    "OK",
    "npm registry availability",
    registryVersion,
    name,
    `target ${sourceVersion} is available`
  );
}

function getNpmVersion(name) {
  try {
    const command =
      process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", `npm view ${name} version`]
        : ["view", name, "version"];

    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function addResult(status, label, version, location, note) {
  results.push({ status, label, version, location, note });
}

function printReport() {
  const width = Math.max(...results.map((result) => result.label.length), 5);
  console.log(`Release version guard`);
  console.log(`Source version: ${sourceVersion || "missing"}`);
  console.log(`Public repo: ${publicDir}`);
  console.log(`Standalone MCP repo: ${mcpDir}`);
  console.log(`npm mode: ${npmMode}`);
  console.log("");

  for (const result of results) {
    const note = result.note ? ` (${result.note})` : "";
    console.log(
      `${result.status.padEnd(5)} ${result.label.padEnd(width)} ${result.version} - ${result.location}${note}`
    );
  }
}

function printHelp() {
  console.log(`Usage: node scripts/check-release-versions.mjs [options]

Checks that release versions match the private root package version.

Options:
  --public-dir <path>      Generated public toolkit repo path
  --mcp-dir <path>         Generated standalone KB MCP repo path
  --require-public         Fail if the public repo path is missing
  --require-mcp            Fail if the standalone MCP repo path is missing
  --npm-published          Require npm registry version to equal source version
  --npm-available          Require source version not to be published yet
  --npm                    Alias for --npm-published
  --npm-mode <mode>        skip, published, or available
  --help                   Show this help
`);
}

function failUsage(message) {
  console.error(message);
  console.error("Run with --help for usage.");
  process.exit(2);
}
