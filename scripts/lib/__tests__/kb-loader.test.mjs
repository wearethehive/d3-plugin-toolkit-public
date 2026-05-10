import { describe, it, expect, beforeEach } from "vitest";
import { getKB, resetKB, patternExists } from "../kb-loader.mjs";

beforeEach(() => {
  resetKB(); // clear cache between tests
});

describe("kb-loader", () => {
  it("loads without throwing", () => {
    expect(() => getKB()).not.toThrow();
  });

  it("returns crashers as an array", () => {
    const { crashers } = getKB();
    expect(Array.isArray(crashers)).toBe(true);
  });

  it("returns apiCoverage as an object", () => {
    const { apiCoverage } = getKB();
    expect(typeof apiCoverage).toBe("object");
    expect(apiCoverage).not.toBeNull();
  });

  it("every crasher has the required shape", () => {
    const { crashers } = getKB();
    for (const c of crashers) {
      expect(c.pattern).toBeInstanceOf(RegExp);
      expect(typeof c.severity).toBe("string");
      expect(typeof c.message).toBe("string");
      expect(typeof c.doc).toBe("string");
      if (c.condition !== undefined) {
        expect(c.condition).toBeInstanceOf(RegExp);
      }
    }
  });

  it("every apiCoverage entry has the required shape", () => {
    const { apiCoverage } = getKB();
    for (const [name, entry] of Object.entries(apiCoverage)) {
      expect(typeof name).toBe("string");
      expect(entry.match).toBeInstanceOf(RegExp);
      expect(Array.isArray(entry.patterns)).toBe(true);
      expect(typeof entry.required).toBe("boolean");
    }
  });

  it("caches results on subsequent calls", () => {
    const first = getKB();
    const second = getKB();
    expect(first).toBe(second); // same reference
  });

  it("resetKB clears the cache", () => {
    const first = getKB();
    resetKB();
    const second = getKB();
    expect(first).not.toBe(second); // different reference
    // but same content
    expect(first.crashers.length).toBe(second.crashers.length);
  });
});

describe("patternExists", () => {
  it("finds existing pattern files", () => {
    // safe-iteration.md is a core pattern that should always exist
    expect(patternExists("safe-iteration.md")).toBe(true);
  });

  it("finds existing API entry files", () => {
    expect(patternExists("track-addNewLayer.md")).toBe(true);
  });

  it("returns false for nonexistent files", () => {
    expect(patternExists("this-does-not-exist-xyz.md")).toBe(false);
  });
});

describe("post-migration required entries", () => {
  it("has a populated crasher set", () => {
    const { crashers } = getKB();
    expect(crashers.length).toBeGreaterThanOrEqual(15);
  });

  it("has a populated API coverage set", () => {
    const { apiCoverage } = getKB();
    expect(Object.keys(apiCoverage).length).toBeGreaterThanOrEqual(15);
  });

  it("all crasher regexes match their intended targets", () => {
    const { crashers } = getKB();
    // Spot-check a few known patterns
    const addLayerCrasher = crashers.find((c) =>
      c.doc.includes("addLayer-crash")
    );
    if (addLayerCrasher) {
      expect(addLayerCrasher.pattern.test("track.addLayer(x)")).toBe(true);
      expect(addLayerCrasher.pattern.test("track.addNewLayer(x)")).toBe(false);
    }
  });

  it("loadOrCreate crasher has a type condition (not overly broad)", () => {
    const { crashers } = getKB();
    const loc = crashers.find((c) =>
      c.doc.includes("loadOrCreate-access-violation")
    );
    if (loc) {
      expect(loc.condition).toBeInstanceOf(RegExp);
      expect(loc.condition.test("d3.Indirection")).toBe(true);
      expect(loc.condition.test("d3.ListIndirectionController")).toBe(true);
    }
  });
});
