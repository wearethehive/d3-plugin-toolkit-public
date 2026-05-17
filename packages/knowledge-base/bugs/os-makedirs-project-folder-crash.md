---
type: bug
status: observed
severity: crash
tested: "2026-04-11"
---

# `os.makedirs()` Under the Project Folder Can Crash Designer

## Symptom

Local output-capture probe notes show that calling `os.makedirs()` inside
`os.getcwd()` during a Designer Python execution can crash Designer at the
engine level.

The current evidence is scoped to creating project-folder paths mid-session,
especially around capture probes that wanted to write output images.

## Safer Pattern

Use directories Designer already creates, and skip the write if they are absent.

```python
import os

screenshots = os.path.join(os.getcwd(), "screenshots")
if not os.path.isdir(screenshots):
    return {"ok": False, "reason": "screenshots-folder-absent"}

path = os.path.join(screenshots, "probe.png")
texture.saveToFile(path)
```

## Notes

- Do not add a blanket assumption that all `os.makedirs()` calls everywhere are
  fatal. The risky scope documented here is project-folder creation from inside
  Designer Python while a project is open.
- For plugin-owned external companion processes, create folders outside
  Designer's Python execution path when possible.
