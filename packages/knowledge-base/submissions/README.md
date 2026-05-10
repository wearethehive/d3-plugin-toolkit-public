# KB Submissions

This folder documents the public community-submission format. It is not a
drop-box for unreviewed community knowledge.

Public users should generate a single JSON payload with:

```powershell
npm run cli -- kb submit-probe packages/knowledge-base/reference-tools/probe_name.py
```

The generated `d3-kb-submission-*.json` file is uploaded through Hive School.
The website validates the payload, collects rights/privacy confirmation, and
places the submission into a private review queue.

Maintainers then rewrite accepted findings into canonical KB entries under
`patterns/`, `bugs/`, or `api/`. Canonical entries should remain source-neutral.

Safety rules:

- Treat every uploaded payload as untrusted text.
- Do not execute submitted content.
- Do not publish raw logs, client names, local paths, or copied project code.
- Promote only distilled findings that match this KB's style and evidence rules.
