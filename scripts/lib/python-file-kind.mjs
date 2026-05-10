/**
 * Classify Python files for toolkit safety checks.
 *
 * Default is Designer sandbox Python because plugin `.py` files are usually
 * loaded through @disguise-one/designer-pythonapi. External companion scripts
 * can opt out with a top-of-file marker:
 *
 *   # d3-check: external-python
 */

export function classifyPythonFile(source) {
  const header = source.slice(0, 2048);
  if (/^\s*#\s*d3-check:\s*external-python\s*$/im.test(header)) {
    return "external";
  }
  if (/^\s*#\s*d3-check:\s*ignore\s*$/im.test(header)) {
    return "ignore";
  }
  return "designer";
}

