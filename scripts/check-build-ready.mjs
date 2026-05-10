/**
 * Vite buildStart hook: scans all Designer `.py` files in a plugin's src/
 * directory for known crashers, phantom methods, and knowledge-base coverage.
 *
 * Imported as a Vite plugin via checkBuildReady() - not run standalone.
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";

import { getKB, patternExists } from "./lib/kb-loader.mjs";
import { stripCommentsAndStrings } from "./lib/python-strip.mjs";
import { findCrasherWarnings } from "./lib/safety-scan.mjs";
import { findPhantomMethods } from "./lib/phantom-methods.mjs";
import { classifyPythonFile } from "./lib/python-file-kind.mjs";

function collectPyFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectPyFiles(full));
    } else if (entry.name.endsWith(".py")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Returns a Vite plugin that checks knowledge base coverage at build start.
 * @param {string} [srcDir] - Absolute path to the plugin's src/ directory.
 *   Defaults to `process.cwd() + '/src'`.
 */
export function checkBuildReady(srcDir) {
  return {
    name: "d3-check-build-ready",
    buildStart() {
      const dir = srcDir || resolve(process.cwd(), "src");
      const pyFiles = collectPyFiles(dir);

      if (pyFiles.length === 0) return;

      const uncovered = new Set();
      const covered = new Map();
      const crasherWarnings = [];
      const phantomWarnings = [];

      for (const file of pyFiles) {
        const raw = readFileSync(file, "utf8");
        const kind = classifyPythonFile(raw);
        if (kind !== "designer") continue;

        const code = stripCommentsAndStrings(raw);

        for (const warning of findCrasherWarnings(raw, code)) {
          crasherWarnings.push({ file, warning });
        }

        for (const phantom of findPhantomMethods(code)) {
          phantomWarnings.push({ file, phantom });
        }

        const apiCoverage = getKB().apiCoverage;
        for (const [apiName, entry] of Object.entries(apiCoverage)) {
          if (!entry.match.test(code)) continue;
          if (entry.patterns.length === 0) continue;

          const existing = entry.patterns.filter(patternExists);
          if (existing.length > 0) {
            if (!covered.has(apiName)) covered.set(apiName, existing);
          } else {
            uncovered.add(apiName);
          }
        }
      }

      if (crasherWarnings.length > 0) {
        const list = crasherWarnings
          .map(({ file, warning }) => `  - ${file}: [${warning.severity}] ${warning.message}\n    See packages/knowledge-base/${warning.doc}`)
          .join("\n");
        this.error(`Build blocked: known Designer crasher detected.\n${list}`);
      }

      if (phantomWarnings.length > 0) {
        const list = phantomWarnings
          .map(({ file, phantom }) => `  - ${file}: ${phantom.callExpr} (${phantom.method} not found in d3.pyi)`)
          .join("\n");
        this.error(
          `Build blocked: phantom Designer method detected.\n` +
            `${list}\nCheck spelling, grep d3.pyi, or write a probe.`
        );
      }

      if (uncovered.size > 0) {
        const list = [...uncovered]
          .map((api) => `  - ${api}`)
          .join("\n");
        this.error(
          `Build blocked: the following Designer APIs have no knowledge base coverage.\n` +
            `Write probe scripts before shipping:\n${list}`
        );
      }

      if (covered.size > 0) {
        console.log("\n  Knowledge base coverage verified for:");
        for (const [api, patterns] of covered) {
          console.log(`    [${api}] ${patterns.join(", ")}`);
        }
        console.log("");
      }
    },
  };
}
