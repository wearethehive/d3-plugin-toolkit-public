---
type: pattern
status: confirmed
tested: "2026-05-26"
designer_version: "r33.1.3.249736"
scope: local-plugin
api_coverage:
  - name: "local project plugin manifest"
    match: "d3plugin\\.json|entry\\s*:\\s*['\\\"]index\\.html|plugins/info"
    related_files:
      - "local-project-plugin-manifest-and-preflight.md"
      - "local-plugin-discovery-stale-after-invalid-manifest.md"
    required: false
---

# Local Project Plugin Manifest and Discovery Preflight

## Manifest Shape

Local project plugins scaffolded by the toolkit use this
`public/d3plugin.json` shape:

```json
{
  "name": "My Plugin",
  "description": "A Disguise Designer plugin",
  "version": "0.1.0",
  "entry": "index.html"
}
```

Keep `"entry": "index.html"` for local project plugins. Do not replace it with
`"url": "index.html"` based on remote plugin or DNS-SD documentation unless a
live Designer probe has confirmed that exact local-plugin manifest shape.

The scaffolded `index.html` should keep the legacy `d3-plugin-*` meta tags
unless a version-specific compatibility probe says otherwise:

```html
<meta name="d3-plugin-width" content="800" />
<meta name="d3-plugin-height" content="600" />
<meta name="d3-plugin-min-width" content="300" />
<meta name="d3-plugin-min-height" content="400" />
<meta name="d3-plugin-resizable" content="true" />
```

## Deterministic Preflight

Before demoing or validating feature work, verify plugin discovery itself:

1. Build/deploy the plugin.
2. Check the deployed plugin root contains `d3plugin.json` and `index.html`.
3. Fetch the deployed manifest through Designer's project web route.
4. Open Plugin Launcher and confirm the plugin appears.
5. If automating the check, query `/api/service/plugins/info` over WebSocket and
   verify the plugin list is non-empty and includes the expected plugin name.

## Stale Discovery Recovery

If the deployed manifest is valid and served correctly but Plugin Launcher still
shows no plugins, treat Designer discovery as stale service state.

Do not continue rebuilding. Restart all d3-related services/processes with the
site's standard `d3killall` or equivalent, then restart Designer and reopen the
project.

## Local vs Remote Manifest Metadata

Remote plugins published over DNS-SD may use `url` metadata to advertise a
custom web endpoint. That is a separate plugin type from local project plugins
that live under a project `plugins/` directory.

Do not transfer remote-plugin manifest assumptions into local project plugin
metadata without a focused live probe.

## Related

- `bugs/local-plugin-discovery-stale-after-invalid-manifest.md`
- `patterns/plugin-window-sizing.md`
- `patterns/remote-plugin-dnssd-publishing.md`

