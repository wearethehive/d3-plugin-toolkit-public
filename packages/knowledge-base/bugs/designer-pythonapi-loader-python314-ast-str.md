---
type: bug
status: confirmed
tested: "2026-10-06"
severity: error
---

# designer-pythonapi Vite loader fails on Python 3.14 `ast.Str`

## Symptom

Importing a plugin module normally through
`@disguise-one/designer-pythonapi/vite-loader` can fail during `vite build`:

```text
[vite-plugin-designer-python-loader] Import error: module 'ast' has no attribute 'Str'
```

The loader launches `python3` and its bundled `python_support/parse.py` checks
`isinstance(elt, ast.Str)` while reading `__all__`. Python 3.14 removed the
deprecated `ast.Str` compatibility alias, so the parser fails before Vite can
transform the `.py` module.

## Confirmed environment

- Windows
- `python3` resolves to Python 3.14
- `@disguise-one/designer-pythonapi` version installed from its GitHub source
- Local plugin production build on 2026-10-06

## Working plugin-local workaround

Keep Python in its `.py` file, import the source with Vite's raw query, and
register it with the library's public `PythonApiClient`:

```typescript
import { PythonApiClient } from '@disguise-one/designer-pythonapi'
import source from './my_module.py?raw'

const client = new PythonApiClient(endpoint, 'my_module', source)
const registration = client.register()
const call = () => client.executeScript('return my_function()')
```

This preserves the registered-module architecture and avoids inlining Python in
TypeScript. The workaround passed Vue typecheck, unit tests, the repository
build-readiness checks, and a full Vite production build.

## Preferred upstream fix

The loader parser should recognise string literals through `ast.Constant` on
modern Python while retaining compatibility with older supported host Python
versions. Do not patch `node_modules` locally; that change is discarded by the
next install.
