/**
 * Integration tests for the pre-execution hooks.
 *
 * These test the hooks the way Claude Code actually calls them: pipe JSON
 * to stdin, check stdout and exit code. This is the real proof that the
 * frontmatter migration didn't break anything.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const SAFETY_HOOK = join(ROOT, "scripts", "check-python-safety.mjs");
const COVERAGE_HOOK = join(ROOT, "scripts", "check-kb-coverage.mjs");

// ── Helpers ────────────────────────────────────────────────────────────────

function bashExec(python) {
  return JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: `d3 exec "${python}"` },
  });
}

function writeFile(content) {
  return JSON.stringify({
    tool_name: "Write",
    tool_input: { file_path: "test.py", content },
  });
}

function editFile(newString) {
  return JSON.stringify({
    tool_name: "Edit",
    tool_input: { file_path: "test.py", new_string: newString },
  });
}

function runHook(hookPath, stdinJson) {
  try {
    const stdout = execSync(`node "${hookPath}"`, {
      input: stdinJson,
      encoding: "utf8",
      timeout: 10000,
      cwd: ROOT,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      exitCode: err.status,
    };
  }
}

// ── Safety hook: crasher detection ─────────────────────────────────────────

describe("check-python-safety (crasher detection)", () => {
  // Every crasher pattern should fire when given its trigger code

  it("detects track.addLayer()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("track.addLayer(x)"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("addNewLayer");
  });

  it("detects track.layers.append()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("track.layers.append(x)"));
    expect(stdout).toContain("CRASH");
  });

  it("detects dir(d3.X)", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("dir(d3.Indirection)"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("dir()");
  });

  it("detects loadOrCreate with Indirection", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      bashExec("resourceManager.loadOrCreate(p, d3.Indirection)")
    );
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("loadOrCreate");
  });

  it("does NOT fire loadOrCreate for non-Indirection types", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      bashExec("resourceManager.loadOrCreate(p, d3.AudioLine)")
    );
    expect(stdout).toBe("");
  });

  it("detects ctrl.resources.append()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("ctrl.resources.append(x)"));
    expect(stdout).toContain("CRASH");
  });

  it("detects ctrl.resources.erase()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("ctrl.resources.erase(0)"));
    expect(stdout).toContain("CRASH");
  });

  it("detects d3.VideoFile", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("d3.VideoFile"));
    expect(stdout).toContain("CRITICAL");
    expect(stdout).toContain("VideoClip");
  });

  it("detects d3.ResourceManager.get()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("d3.ResourceManager.get()"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("resourceManager");
  });

  it("detects state.track", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("state.track"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("guisystem.track");
  });

  it("detects seq.key(N).property", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("seq.key(0).r"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("KeyAsKeyContainer");
  });

  it("detects setString(0, ...)", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("ks.setString(0, path)"));
    expect(stdout).toContain("ERROR");
    expect(stdout).toContain("KeySequence");
  });

  it("detects track.cues.clear()", () => {
    const { stdout } = runHook(SAFETY_HOOK, bashExec("track.cues.clear()"));
    expect(stdout).toContain("CRASH");
    expect(stdout).toContain("removeAtTime");
  });

  it("detects .module.mapping assignment", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      bashExec("layer.module.mapping = proj")
    );
    expect(stdout).toContain("WARNING");
    expect(stdout).toContain("findSequence");
  });

  // Condition-gated rules

  it("detects except Exception ONLY when import d3 is present", () => {
    const withD3 = runHook(
      SAFETY_HOOK,
      writeFile("import d3\ntry:\n    x = d3.foo\nexcept Exception:\n    pass")
    );
    expect(withD3.stdout).toContain("WARNING");
    expect(withD3.stdout).toContain("bare except");

    const withoutD3 = runHook(
      SAFETY_HOOK,
      writeFile("try:\n    x = foo\nexcept Exception:\n    pass")
    );
    expect(withoutD3.stdout).toBe("");
  });

  // False positive avoidance

  it("does NOT fire on patterns inside comments", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      writeFile("# track.addLayer(x) is dangerous\nx = 1")
    );
    expect(stdout).toBe("");
  });

  it("does NOT fire on patterns inside strings", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      writeFile('msg = "do not use track.addLayer(x)"\nx = 1')
    );
    expect(stdout).toBe("");
  });

  // Non-Python passthrough

  it("passes through non-Python Bash commands silently", () => {
    const input = JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
    });
    const { stdout, exitCode } = runHook(SAFETY_HOOK, input);
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  it("passes through non-Python Write calls silently", () => {
    const input = JSON.stringify({
      tool_name: "Write",
      tool_input: { file_path: "test.js", content: "track.addLayer(x)" },
    });
    const { stdout, exitCode } = runHook(SAFETY_HOOK, input);
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  // All tool input methods

  it("detects crashers in Edit tool input", () => {
    const { stdout } = runHook(
      SAFETY_HOOK,
      editFile("track.addLayer(x)")
    );
    expect(stdout).toContain("CRASH");
  });

  // Exit code

  it("always exits 0 (warn, never block)", () => {
    const { exitCode } = runHook(SAFETY_HOOK, bashExec("track.addLayer(x)"));
    expect(exitCode).toBe(0);
  });
});

// ── Coverage hook: API coverage checks ─────────────────────────────────────

describe("check-kb-coverage (API coverage)", () => {
  it("shows coverage info for findSequence", () => {
    const { stdout, exitCode } = runHook(
      COVERAGE_HOOK,
      bashExec("layer.findSequence('mapping')")
    );
    expect(stdout).toContain("layer.findSequence");
    expect(stdout).toContain("layer-mapping-assignment.md");
    expect(exitCode).toBe(0);
  });

  it("shows coverage info for setExpression", () => {
    const { stdout, exitCode } = runHook(
      COVERAGE_HOOK,
      bashExec("field.setExpression('time * 2')")
    );
    expect(stdout).toContain("setExpression");
    expect(stdout).toContain("expression-api.md");
    expect(exitCode).toBe(0);
  });

  it("does NOT block loadOrCreate anymore (was overly broad)", () => {
    const { stdout, exitCode } = runHook(
      COVERAGE_HOOK,
      bashExec("resourceManager.loadOrCreate(path, d3.X)")
    );
    expect(exitCode).toBe(0);
    // Should show as info, not blocked
    expect(stdout).not.toContain("BLOCKED");
  });

  it("passes through safe Python silently", () => {
    const { stdout, exitCode } = runHook(
      COVERAGE_HOOK,
      bashExec("x = 1 + 2")
    );
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });

  it("passes through non-Python commands silently", () => {
    const input = JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "git status" },
    });
    const { stdout, exitCode } = runHook(COVERAGE_HOOK, input);
    expect(stdout).toBe("");
    expect(exitCode).toBe(0);
  });
});

// ── Loader consistency: frontmatter matches expected rules ─────────────────

describe("frontmatter-to-hook consistency", () => {
  it("every crasher doc path points to a real file", async () => {
    const { getKB } = await import("../kb-loader.mjs");
    const { existsSync } = await import("fs");

    const kb = getKB();
    for (const c of kb.crashers) {
      const fullPath = join(ROOT, "packages", "knowledge-base", c.doc);
      expect(existsSync(fullPath), `Missing: ${c.doc}`).toBe(true);
    }
  });

  it("every api_coverage related_file exists on disk", async () => {
    const { getKB, patternExists } = await import("../kb-loader.mjs");

    const kb = getKB();
    for (const [name, entry] of Object.entries(kb.apiCoverage)) {
      for (const file of entry.patterns) {
        expect(
          patternExists(file),
          `API "${name}" references "${file}" which doesn't exist`
        ).toBe(true);
      }
    }
  });
});
