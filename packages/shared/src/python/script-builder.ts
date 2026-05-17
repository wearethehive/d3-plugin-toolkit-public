/**
 * Compose Python scripts from tested template snippets.
 *
 * Usage:
 *   const script = new ScriptBuilder()
 *     .use(IMPORT_D3, CREATE_OR_DUPLICATE)
 *     .code(`ind = _create_or_duplicate('objects/indirection/test.apx', d3.Indirection)`)
 *     .code(`return str(ind)`)
 *     .build()
 */
export class ScriptBuilder {
  private preamble: string[] = []
  private body: string[] = []

  /** Add template snippets to the preamble. Deduplicates automatically. */
  use(...templates: string[]): this {
    for (const t of templates) {
      if (!this.preamble.includes(t)) {
        this.preamble.push(t)
      }
    }
    return this
  }

  /** Add a line or block of Python code to the script body. */
  code(python: string): this {
    this.body.push(python)
    return this
  }

  /** Build the final Python script string. */
  build(): string {
    return [...this.preamble, '', ...this.body].join('\n')
  }
}
