# KB Submission Pipeline

Community probe submissions use the toolkit CLI as the capture point. The CLI
always writes a local JSON payload first. It uploads only in `community` mode,
only after user telemetry consent, and only when an isolated collector endpoint
is configured.

The collector must run outside the WordPress host, for example on a dedicated
LXC behind an ingest-only subdomain. WordPress is not part of the tooling path:
raw payloads should not be posted to, stored by, or processed inside WordPress,
and the review dashboard should live in private maintainer tooling.

## User Flow

1. User runs a focused probe through the toolkit:

   ```powershell
   npm run cli -- kb submit-probe packages/knowledge-base/reference-tools/probe_name.py
   ```

2. The CLI writes one local file:

   ```text
   kb-submissions/d3-kb-submission-<probe>-<date>.json
   ```

3. The CLI resolves `kbContributionMode` from `.d3-toolkit.json`.
4. In `maintainer` mode, the CLI skips upload and records local evidence for KB
   promotion.
5. In `community` mode, the CLI uploads only if user-level telemetry consent is
   on and `kbTelemetry.uploadEndpoint` or `D3TK_KB_UPLOAD_ENDPOINT` is set.
6. The isolated collector validates the JSON, applies rate limits and daily
   accepted-upload caps, and quarantines the raw payload.
7. Maintainer tooling reads the private queue for review, dedupe, and
   collation.
8. Maintainers rewrite accepted findings into canonical KB Markdown.

## What The Payload Contains

- Toolkit version and commit.
- Basic Designer/Node environment information.
- Probe filename and SHA-256 hash.
- Probe status, sanitized return value, and sanitized logs.
- A draft Markdown note for maintainer review.
- Redaction metadata.
- Client-side consent metadata. User telemetry consent is stored outside the
  repo and is required before upload; the payload itself is still treated as
  untrusted.

The probe source is not embedded. The payload is evidence for review, not a
public KB entry.

## Collector Handling Rules

- Accept only `.json` files that parse as UTF-8 text.
- Enforce a size limit before parsing.
- Validate against `packages/knowledge-base/submissions/schema-v1.json`.
- Reject any payload that is not exactly submission-shaped. Keep schema
  `additionalProperties: false` and do not coerce unknown objects into partial
  submissions.
- Return generic rejection codes: `413` too large, `415` wrong content type,
  `400` malformed/schema-invalid JSON, `429` rate-limited, and `404` for
  non-ingest routes.
- Treat the payload as untrusted text.
- Sanitize Markdown before previewing.
- Do not execute anything from the payload.
- Do not send the raw payload to WordPress.
- Do not store payload data in WordPress post content, post meta, or the Media
  Library.
- Quarantine the raw payload in a non-public location and keep review metadata
  with the quarantined object.
- Cap accepted uploads per day so abuse makes submission temporarily
  unavailable instead of producing open-ended storage or operation usage.
- Require client telemetry consent before upload. The CLI consent copy must tell
  users to enable sharing only when they are allowed to share non-confidential
  Designer API evidence.
- Store submissions in a private review queue consumed only by maintainer
  tooling.

## Client Configuration

Private canonical repo:

```json
{
  "kbContributionMode": "maintainer"
}
```

Public repo default:

```json
{
  "kbContributionMode": "community",
  "kbTelemetry": {
    "default": "off",
    "promptOnFirstEligibleProbe": true
  }
}
```

Telemetry consent is user-level state:

```powershell
npm run cli -- kb telemetry status
npm run cli -- kb telemetry on
npm run cli -- kb telemetry off
```

The client should not hardcode a fake endpoint. Add
`kbTelemetry.uploadEndpoint` only after the isolated collector exists.

## Promotion Rule

The canonical KB should contain source-neutral facts. Do not copy a submission
directly into `patterns/`, `bugs/`, or `api/`; rewrite the accepted behavior in
the repo's KB style.
