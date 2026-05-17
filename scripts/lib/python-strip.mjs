/**
 * Utility: strips comments and string literals from Python code.
 *
 * Used by pre-execution hooks to avoid false-positive matches on patterns
 * that appear inside comments or string literals rather than live code.
 *
 * Exports:
 *   stripCommentsAndStrings(code) — returns code with comments and strings removed.
 */

/**
 * Remove Python comments and string literals so regex matching only hits live code.
 *
 * Order of operations:
 *   1. Triple-quoted strings (""" and ''')
 *   2. Single-line strings (" and ')
 *   3. Single-line comments (# to end of line)
 *
 * @param {string} code - Raw Python source
 * @returns {string} Code with comments and strings replaced by whitespace
 */
export function stripCommentsAndStrings(code) {
  // 1. Remove triple-quoted strings (greedy-safe via non-greedy quantifier)
  let stripped = code.replace(/"""[\s\S]*?"""/g, "");
  stripped = stripped.replace(/'''[\s\S]*?'''/g, "");

  // 2. Remove single/double-quoted strings (single-line only, handle escapes)
  stripped = stripped.replace(/"(?:[^"\\]|\\.)*"/g, "");
  stripped = stripped.replace(/'(?:[^'\\]|\\.)*'/g, "");

  // 3. Remove single-line comments (# to end of line)
  stripped = stripped.replace(/#[^\n]*/g, "");

  return stripped;
}
