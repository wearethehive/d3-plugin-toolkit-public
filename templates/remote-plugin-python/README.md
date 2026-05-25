# {{title}}

Remote Disguise Designer plugin scaffolded by d3-plugin-toolkit.

## Development

Install workspace dependencies from the repository root:

```bash
npm install
```

Install the Python remote plugin dependency:

```bash
python -m pip install -r packages/remote-plugins/{{pluginName}}/backend/requirements.txt
```

Start the remote plugin:

```bash
npm run cli -- remote dev {{pluginName}}
```

The dev runner starts:

- a Vite frontend server,
- the Python backend API server,
- a DNS-SD publisher using `designer-plugin`.

Designer discovers the plugin while the dev runner is active.

## Verification

```bash
npm run cli -- remote smoke {{pluginName}}
```

The smoke check validates local config and can optionally check a running server.
When the dev runner is active, use:

```bash
npm run cli -- remote smoke {{pluginName}} -- --server --designer --dnssd
```

The DNS-SD check requires Python `zeroconf`, which is installed by the
`designer-plugin` dependency.

## Packaging

```bash
npm run cli -- remote package {{pluginName}}
```

The package command creates `package/{{pluginName}}/` with the built frontend,
backend files, config, and run scripts. This v1 path is Windows-first and does
not generate an installer.

## Notes

This backend is normal external Python 3, not Designer sandbox Python. Any code
that is sent to Designer for execution still needs the repository's Designer
Python pre-flight and knowledge-base workflow.
