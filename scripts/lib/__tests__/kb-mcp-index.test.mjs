import { describe, expect, it } from "vitest";
import { buildKbMcpIndex, containsPrivateMarker } from "../kb-mcp-index.mjs";

describe("kb-mcp-index", () => {
  it("builds compact entries for public KB markdown and reference docs", () => {
    const index = buildKbMcpIndex();

    expect(index.length).toBeGreaterThan(50);
    expect(index.some((entry) => entry.id === "patterns/bare-except-required")).toBe(true);
    expect(index.some((entry) => entry.id === "bugs/resourcemanager-get-crash")).toBe(true);
    expect(index.some((entry) => entry.id === "api/track-addNewLayer")).toBe(true);
    expect(index.some((entry) => entry.id === "docs/reference")).toBe(true);
  });

  it("uses stable resource URIs and relative paths", () => {
    const index = buildKbMcpIndex();
    const entry = index.find((item) => item.id === "patterns/bare-except-required");

    expect(entry).toBeTruthy();
    expect(entry.resourceUri).toBe("d3kb://patterns/bare-except-required");
    expect(entry.path).toBe("packages/knowledge-base/patterns/bare-except-required.md");
    expect(entry.summary.length).toBeGreaterThan(20);
    expect(entry.searchText).toContain("except Exception");
  });

  it("filters KB entries containing private markers by default", () => {
    const index = buildKbMcpIndex();

    expect(containsPrivateMarker("packages/plugins/smartGroups/src/foo.py")).toBe(true);
    expect(index.some((entry) => entry.id === "patterns/smartgroups-sequential-media-build")).toBe(false);
  });

  it("normalizes related file references into entry IDs", () => {
    const index = buildKbMcpIndex();
    const entry = index.find((item) => item.id === "patterns/active-context-resolution");

    expect(entry).toBeTruthy();
    expect(entry.related).toContain("patterns/transport-manager-access");
    expect(entry.related).not.toContain("transport-manager-access.md");
  });

  it("does not expose raw probes or generated logs", () => {
    const index = buildKbMcpIndex();

    for (const entry of index) {
      expect(entry.path).not.toContain("reference-tools");
      expect(entry.path).not.toContain("test-log.jsonl");
      expect(entry.path).not.toContain("session-log.jsonl");
    }
  });
});
