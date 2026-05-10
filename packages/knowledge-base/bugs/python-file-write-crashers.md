---
type: bug
status: confirmed
tested: "2026-05-04"
severity: crash
---

# Python file-write crashers in Designer execute context

## Symptoms
HTTP 500, Python log: (none). No Python output at all — crash happens at
engine level, bypassing all try/except.

## Root Causes

### 1. `os.makedirs()` on existing directory → native crash
Calling `os.makedirs(path)` when the directory already exists crashes
Designer at the C++ engine level. Bypasses `try/except Exception`.

**Wrong:**
```python
if not os.path.exists(directory):
    try:
        os.makedirs(directory)
    except Exception:
        pass
```

**Right:** Don't call makedirs at all. Check `os.path.isdir()` and only
write if the directory already exists. The `objects/table/` directory is
present in every live d3 project — rely on it.

---

### 2. Literal non-ASCII character in Python source → native crash
Embedding the literal BOM character `﻿` (U+FEFF) directly in a Python
source string (e.g. `u'﻿'`) crashes Designer's Python engine. This is a
Python 2.7 source-encoding issue — without `# -*- coding: utf-8 -*-`,
non-ASCII literals cause an engine-level failure that bypasses try/except.

**Wrong:**
```python
f.write((u'﻿' + csv_text).encode('utf-8'))   # literal U+FEFF in source
```

**Right:** Use raw bytes or a unicode escape:
```python
bom = b'\xef\xbb\xbf'
f.write(bom + csv_text.encode('utf-8'))
```

---

### 3. `except Exception` does not catch Designer execution timeouts
Designer raises `KeyboardInterrupt` (a `BaseException`, not `Exception`)
when the Python execution timeout (`pythonApiExecutionTimeout`) is exceeded.
Using `except Exception` lets it escape, causing HTTP 500 with no Python log.

**Wrong:**
```python
except Exception as e:
    return json.dumps({'ok': False, 'error': str(e)})
```

**Right:** Use `BaseException` in functions that do heavy work (e.g. iterating
all sections + all layers):
```python
except BaseException as e:
    return json.dumps({'ok': False, 'error': '%s: %s' % (type(e).__name__, str(e))})
```

---

## Workaround for locked files (file open in Excel)
Write to the base path first; if that raises, fall back to a timestamped copy:
```python
import datetime
try:
    with open(path, 'wb') as f:
        f.write(content)
    return path
except BaseException:
    ts = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    path_ts = base + '_' + ts + '.csv'
    with open(path_ts, 'wb') as f:
        f.write(content)
    return path_ts
```

## Debugging method that worked
Isolate pieces with separate exported functions:
1. `debug_save` — calls `get_cuelist` + `_build_csv_rows`, no file write → confirms Designer API calls work nested
2. No-op `save_cuelist_csv` returning hardcoded JSON → confirms function is reachable
3. Path probe (`os.getcwd()`, `os.path.isdir()`) → confirms which directories exist
4. Tiny write (`open(path, 'wb'); f.write(b'hello')`) → confirms `open()` itself works
5. Full write with `BaseException` catching → reveals actual error class
