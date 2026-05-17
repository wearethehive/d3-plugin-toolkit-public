import { describe, it, expect } from "vitest";
import { classifyPythonFile } from "../python-file-kind.mjs";

describe("classifyPythonFile", () => {
  it("defaults to Designer sandbox Python", () => {
    expect(classifyPythonFile("def run():\n    pass\n")).toBe("designer");
  });

  it("detects external Python marker", () => {
    expect(classifyPythonFile("# d3-check: external-python\nimport threading\n")).toBe("external");
  });

  it("detects ignore marker", () => {
    expect(classifyPythonFile("# d3-check: ignore\n")).toBe("ignore");
  });
});

