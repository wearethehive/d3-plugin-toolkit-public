/**
 * Shared safety scan for Designer Python.
 */

import { getKB, patternExists } from "./kb-loader.mjs";
import { stripCommentsAndStrings } from "./python-strip.mjs";
import { semgrepAvailable, runSemgrep } from "./semgrep-runner.mjs";
import { findPhantomMethods } from "./phantom-methods.mjs";

export function findCrasherWarnings(raw, stripped = stripCommentsAndStrings(raw)) {
  if (semgrepAvailable()) {
    const semgrepWarnings = runSemgrep(raw);
    const regexOnly = getKB().crashers.filter((c) => c.doc.includes("registermodule"));
    for (const crasher of regexOnly) {
      if (!crasher.pattern.test(stripped)) continue;
      if (crasher.condition && !crasher.condition.test(raw)) continue;
      semgrepWarnings.push(crasher);
    }
    return semgrepWarnings;
  }

  const warnings = [];
  for (const crasher of getKB().crashers) {
    if (!crasher.pattern.test(stripped)) continue;
    if (crasher.condition && !crasher.condition.test(raw)) continue;
    warnings.push(crasher);
  }
  return warnings;
}

export function findCoverageIssues(stripped) {
  const blocked = [];
  const info = [];
  const uncovered = [];
  const unknownApis = [];
  const apiCoverage = getKB().apiCoverage;

  for (const [apiName, entry] of Object.entries(apiCoverage)) {
    if (!entry.match.test(stripped)) continue;
    if (entry.patterns.length === 0) continue;

    const existing = entry.patterns.filter(patternExists);

    if (entry.required && existing.length > 0) {
      blocked.push({ apiName, patterns: existing });
    } else if (existing.length > 0) {
      info.push({ apiName, patterns: existing });
    } else {
      uncovered.push(apiName);
    }
  }

  const knownPatterns = Object.values(apiCoverage).map((e) => e.match);
  const broadPatterns = [
    /d3\.(\w+)\s*\(/g,
    /resourceManager\.(\w+)\s*\(/g,
    /guisystem\.(\w+)/g,
  ];
  for (const bp of broadPatterns) {
    let m;
    while ((m = bp.exec(stripped)) !== null) {
      const call = m[0].replace(/\s*\($/, "");
      const isKnown = knownPatterns.some((kp) => kp.test(m[0]));
      if (!isKnown && !unknownApis.includes(call)) {
        unknownApis.push(call);
      }
    }
  }

  return { blocked, info, uncovered, unknownApis };
}

export function scanDesignerPython(raw) {
  const stripped = stripCommentsAndStrings(raw);
  return {
    stripped,
    crasherWarnings: findCrasherWarnings(raw, stripped),
    phantomWarnings: findPhantomMethods(stripped),
    coverage: findCoverageIssues(stripped),
  };
}

