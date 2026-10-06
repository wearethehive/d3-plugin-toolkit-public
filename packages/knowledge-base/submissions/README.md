# KB Submissions

This folder documents the public community-submission format. It is not a
drop-box for unreviewed community knowledge.

Public users or assistants should generate a single JSON payload with:

```powershell
npm run cli -- kb submit-probe packages/knowledge-base/reference-tools/probe_name.py
```

The generated `d3-kb-submission-*.json` file is local evidence first. In
community mode, the CLI may upload it only after user consent and only when an
isolated collector endpoint is configured. The collector is separate from
WordPress and places submissions into a private queue for maintainer review and
collation.

Maintainers then rewrite accepted findings into canonical KB entries under
`patterns/`, `bugs/`, or `api/`. Canonical entries should remain source-neutral.

Safety rules:

- Treat every uploaded payload as untrusted text.
- Reject anything that does not exactly match `schema-v1.json`.
- Do not execute submitted content.
- Do not publish raw logs, client names, local paths, or copied project code.
- Promote only distilled findings that match this KB's style and evidence rules.
