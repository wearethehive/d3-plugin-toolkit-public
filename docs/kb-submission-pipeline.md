# KB Submission Pipeline

Community probe submissions use Hive School as the public entrypoint. The
toolkit does not auto-upload submissions.

## User Flow

1. User runs a focused probe through the toolkit:

   ```powershell
   npm run cli -- kb submit-probe packages/knowledge-base/reference-tools/probe_name.py
   ```

2. The CLI writes one file:

   ```text
   kb-submissions/d3-kb-submission-<probe>-<date>.json
   ```

3. User uploads that single JSON file through Hive School.
4. Hive School validates the JSON, previews it, collects consent/rights
   confirmation, and creates a private review item.
5. Maintainers rewrite accepted findings into canonical KB Markdown.

## What The Payload Contains

- Toolkit version and commit.
- Basic Designer/Node environment information.
- Probe filename and SHA-256 hash.
- Probe status, sanitized return value, and sanitized logs.
- A draft Markdown note for maintainer review.
- Redaction metadata.

The probe source is not embedded. The payload is evidence for review, not a
public KB entry.

## Website Handling Rules

- Accept only `.json` files that parse as UTF-8 text.
- Enforce a size limit before parsing.
- Validate against `packages/knowledge-base/submissions/schema-v1.json`.
- Treat the payload as untrusted text.
- Sanitize Markdown before previewing.
- Do not execute anything from the payload.
- Collect explicit confirmation that the user has rights to submit the result
  and that it contains no confidential project/client data.
- Store submissions in a private review queue.

## Promotion Rule

The canonical KB should contain source-neutral facts. Do not copy a submission
directly into `patterns/`, `bugs/`, or `api/`; rewrite the accepted behavior in
the repo's KB style.
