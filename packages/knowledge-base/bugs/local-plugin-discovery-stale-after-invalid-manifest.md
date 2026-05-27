---
type: bug
status: confirmed
tested: "2026-05-26"
designer_version: "r33.1.3.249736"
severity: error
api_coverage:
  - name: "local plugin discovery stale after invalid manifest"
    match: "d3plugin\\.json|plugins/info|Plugin Launcher|No plugins detected"
    related_files:
      - "local-plugin-discovery-stale-after-invalid-manifest.md"
      - "local-project-plugin-manifest-and-preflight.md"
    required: false
---

# Local Plugin Discovery Can Stay Empty After Invalid Manifest Metadata

## Symptom

Designer Plugin Launcher reports no plugins, and the service WebSocket returns
an empty plugin list even though the plugin files are present and served over
HTTP.

Observed payload from `/api/service/plugins/info`:

```json
{"plugins":{"plugins":[]},"isSessionActive":false}
```

## Trigger Observed

A local project plugin was deployed with invalid/unproven local manifest
metadata: the known-working scaffold shape using `"entry": "index.html"` was
temporarily replaced with a remote-style/custom endpoint shape using
`"url": "index.html"`.

After restoring the valid manifest on disk, Designer continued returning an
empty plugin list until the d3 service stack was restarted.

## Evidence

The project web server served the bad manifest during the failure window, then
served the restored manifest later:

- bad manifest response size: 82 bytes
- restored manifest response size: 126 bytes

Even after the restored manifest was served, `/api/service/plugins/info`
continued returning the empty 52-byte response until all d3 services were
killed and Designer was restarted.

After restart, Designer logged the project plugin directory scan and opened the
same plugin from the project URL.

## Recovery

Do not keep rebuilding the plugin when discovery is stuck in this state.

1. Confirm `d3plugin.json` uses the local project plugin manifest shape.
2. Confirm `index.html` exists in the deployed plugin root.
3. Run the site's standard `d3killall` or equivalent full d3 service/process
   stop.
4. Restart Designer and reopen the project.
5. Reopen Plugin Launcher and verify the plugin appears.

## Prevention

Treat plugin discovery metadata as service-cached state, not as ordinary
frontend hot reload. Feature code and static assets may hot reload; invalid
plugin discovery metadata can require a full d3 service restart before
Designer trusts the plugin list again.

For local project plugins, use the scaffold manifest with `"entry":
"index.html"`. Do not infer or substitute `"url"` from remote plugin docs unless
a live probe has confirmed that exact shape on the target Designer version.

## Related

- `patterns/local-project-plugin-manifest-and-preflight.md`

