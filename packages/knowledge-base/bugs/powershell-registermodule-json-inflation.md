---
type: bug
status: confirmed
tested: "2026-05-26"
severity: warning
api_coverage:
  - name: "registermodule PowerShell JSON body"
    match: "ConvertTo-Json"
    related_files: ["powershell-registermodule-json-inflation.md"]
    required: false
---

# PowerShell `ConvertTo-Json` Can Inflate `registermodule` Bodies

## Symptom

Posting Designer Python module source to `/api/session/python/registermodule`
from PowerShell returned:

```text
413 Request Entity Too Large
nginx/1.22.0
```

The apparent failures happened with probe files around 2.9 KB and 6.6 KB.

## Root Cause

The request was built with PowerShell `ConvertTo-Json` over a `Get-Content -Raw`
value that PowerShell serialized as a rich object instead of a plain JSON
string. A 2.3 KB Python file produced a roughly 3.8 MB JSON body.

## Confirmation

The same files registered successfully when posted from Node with
`JSON.stringify({ moduleName, contents })`:

- 2.3 KB Python file, 2.5 KB JSON body, HTTP 200
- 2.6 KB Python file, 2.8 KB JSON body, HTTP 200
- 6.6 KB Python file, 7.2 KB JSON body, HTTP 200
- 2.9 KB Python file, 3.2 KB JSON body, HTTP 200

## Workaround

Use Node, the toolkit CLI, or another JSON client that serializes module source
as a plain string. If PowerShell must be used, inspect the serialized body size
and body shape before posting.

## Impact

This is not evidence of a Designer `registermodule` payload limit. Do not split
plugin Python modules solely because of this PowerShell 413 result.

