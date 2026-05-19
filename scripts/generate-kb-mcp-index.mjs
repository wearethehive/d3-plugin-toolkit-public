#!/usr/bin/env node

/**
 * Generate the compact retrieval index used by the read-only KB MCP.
 */

import { writeKbMcpIndex } from "./lib/kb-mcp-index.mjs";

const { entries, indexPath } = writeKbMcpIndex();
console.log(`Generated ${indexPath} with ${entries.length} entries.`);
