---
type: pattern
status: confirmed
tested: "2026-10-06"
scope: registered-python-module
api_coverage:
  - name: "state.projectName"
    match: "state\\.projectName"
    related_files: ["project-file-history-archive-copy.md", "video-content-management.md"]
    required: false
---

# Copy the Active Project File Into Designer History

## Purpose

Create a tangible timestamped backup of the last `.d3` or `.d3starter` state
Designer wrote to disk, from a registered local-plugin Python module.

Designer’s Project Settings documentation describes **Archive project file** as
a save-as into the project’s existing `history` folder. The Python API does not
expose a verified callable equivalent or a whole-project restore method.

## Registered-module path resolution

`d3.projectPaths` is not available from the registered module context tested in
r33.0.2. Resolve the active folder with the established `_os.getcwd()` pattern,
then match `state.projectName` to the project file on disk:

```python
import os as _os
import shutil as _shutil
import time as _time

project_folder = _os.getcwd()
project_name = str(state.projectName)
candidates = [
    name for name in _os.listdir(project_folder)
    if name.lower().endswith(".d3") or name.lower().endswith(".d3starter")
]
matching = [
    name for name in candidates
    if _os.path.splitext(name)[0].lower() == project_name.lower()
]
if len(matching) != 1:
    raise RuntimeError("Could not identify the active project file safely")

source = _os.path.join(project_folder, matching[0])
history = _os.path.join(project_folder, "history")
if not _os.path.isdir(history):
    raise RuntimeError("Designer history folder does not exist yet")

stem, extension = _os.path.splitext(matching[0])
stamp = _time.strftime("%Y-%m-%d_%H%M%S")
target = _os.path.join(history, "%s_ARCHIVE_%s%s" % (stem, stamp, extension))
_shutil.copy2(source, target)
if _os.path.getsize(source) != _os.path.getsize(target):
    raise RuntimeError("Archive copy did not verify")
```

Use aliases such as `_os`: Designer injects an `os` global whose type is
`d3.OS`, which can shadow the standard-library module in registered modules.

## Safety boundary

- Reuse the existing `history` directory. Do not call `os.makedirs()` inside
  the open project; that has separate native-crash history.
- Reject ambiguous projects with multiple unmatched project files.
- Avoid `resourceManager.saveAll()`; it can touch unrelated resources.
- This copies the last on-disk project state. It does not flush unsaved in-memory
  changes and does not implement restore.

## Probe result

`reference-tools/probe_project_history_archive_copy.py` ran as a registered
module on r33.0.2. It copied the active `.d3` project into the existing history
folder, verified equal source and target sizes (898,576 bytes), and removed the
probe copy successfully. The historical test log retains the originating
project and filename as provenance.
