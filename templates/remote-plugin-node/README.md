# {{title}}

Remote Disguise Designer plugin scaffolded by d3-plugin-toolkit.

## Development

Install workspace dependencies from the repository root:

```bash
npm install
```

Install the Python publisher dependency:

```bash
python -m pip install -r packages/remote-plugins/{{pluginName}}/backend/requirements.txt
```

Start the remote plugin:

```bash
npm run cli -- remote dev {{pluginName}}
```

The dev runner starts:

- a Vite frontend server,
- the Node backend API server,
- a DNS-SD publisher sidecar using the official Python `designer-plugin`
  library.

Designer discovers the plugin while the dev runner is active.

## Verification

```bash
npm run cli -- remote smoke {{pluginName}}
```

When the dev runner is active, use:

```bash
npm run cli -- remote smoke {{pluginName}} -- --server --designer --dnssd
```

The DNS-SD check requires Python `zeroconf`, which is installed by the
`designer-plugin` publisher sidecar dependency.

## Packaging

```bash
npm run cli -- remote package {{pluginName}}
```

The package command creates `package/{{pluginName}}/` with the built frontend,
Node backend, publisher sidecar, config, and run scripts. This v1 path is
Windows-first and does not generate an installer.

## Notes

The Node backend talks to Designer's HTTP execution API for simple connectivity
checks. Any substantive Python sent to Designer still needs the repository's
Designer Python pre-flight and knowledge-base workflow.
