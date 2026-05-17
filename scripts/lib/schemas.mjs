/**
 * Zod schemas for knowledge base frontmatter validation.
 *
 * Three document types: bug, pattern, api. Each carries optional `crashers`
 * and/or `api_coverage` arrays that the KB loader compiles into the runtime
 * CRASHERS and API_COVERAGE data structures used by pre-execution hooks.
 */

import { z } from "zod";

// ── Shared sub-schemas ─────────────────────────────────────────────────────

const CrasherEntry = z.object({
  pattern: z.string(), // regex source string
  condition: z.string().optional(), // optional secondary regex
  message: z.string(),
  severity: z.enum(["crash", "critical", "error", "warning"]),
});

const ApiCoverageEntry = z.object({
  name: z.string(), // e.g. "addNewLayer"
  match: z.string(), // regex source string
  related_files: z.array(z.string()), // KB Markdown filenames in patterns/, bugs/, or api/
  required: z.boolean().default(false),
});

// ── Document type schemas ──────────────────────────────────────────────────

const BaseFrontmatter = {
  status: z.string(),
  tested: z.string().optional(),
  designer_version: z.string().optional(),
};

export const BugFrontmatter = z.object({
  ...BaseFrontmatter,
  type: z.literal("bug"),
  severity: z.enum([
    "crash",
    "critical",
    "error",
    "warning",
    "silent-failure",
    "cosmetic",
  ]),
  crashers: z.array(CrasherEntry).optional(),
  api_coverage: z.array(ApiCoverageEntry).optional(),
});

export const PatternFrontmatter = z.object({
  ...BaseFrontmatter,
  type: z.literal("pattern"),
  crashers: z.array(CrasherEntry).optional(),
  api_coverage: z.array(ApiCoverageEntry).optional(),
});

export const ApiFrontmatter = z.object({
  ...BaseFrontmatter,
  type: z.literal("api"),
  api_coverage: z.array(ApiCoverageEntry).optional(),
});

export const KBFrontmatter = z.discriminatedUnion("type", [
  BugFrontmatter,
  PatternFrontmatter,
  ApiFrontmatter,
]);
