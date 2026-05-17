---
type: pattern
status: confirmed
tested: "2026-04-08"
designer_version: "r32.4"
---

# Subprocess Spawn from the Designer Python Sandbox

## Rule

The Designer Python sandbox DOES allow spawning external processes via
`subprocess.Popen`, but **only non-blocking, fully-detached** invocation is
safe. Any blocking call (`subprocess.call`, `os.popen`, `os.system`) hangs
Designer's render loop and will be killed by the execution monitor
(~4 second limit observed in this probe). Use Popen with `CREATE_NO_WINDOW`,
DEVNULL stdio, and `close_fds=True` — nothing else.

## What works (confirmed)

| API | Result | Notes |
|---|---|---|
| `import subprocess` | ✅ | Python 2.7.18 subprocess module is importable |
| `subprocess.Popen(...)` | ✅ | Returns a real Popen object; non-blocking when stdio is detached |
| `subprocess.call(...)` | ✅ (returned 0) | **BLOCKING — dangerous on Designer main thread** |
| `os.popen(cmd).read()` | ✅ | **BLOCKING — dangerous on Designer main thread** |
| `os.startfile(path)` | ✅ | Windows-only, shell-association launch |
| `os.kill` | ✅ exists | Needed for teardown of spawned PIDs |
| `os.getpid` | ✅ exists | Designer process identity |
| `import ctypes` + `kernel32.CreateProcessW` | ✅ reachable | Nuclear fallback if subprocess ever stops working |

## What does NOT work

| API | Result | Reason |
|---|---|---|
| `subprocess.run(...)` | ❌ | Not present in Python 2.7.18 (added in Python 3.5) |
| `os.system(...)` | ❌ | Blocked by the sandbox |
| `os.spawnv(...)` | ❌ | Blocked by the sandbox |

## ⚠️ Critical safety constraint: Designer's Python runs on the main render thread

Every `d3 exec` script runs synchronously on Designer's main render thread.
**Any call that blocks — even for a second — freezes the render loop.**
Designer's Python execution monitor kills scripts that exceed ~4 seconds of
wall time.

This is observed directly in the subprocess probe's d3Log output:

```
!!! Main thread hung < wait < wait < ...
!!!!! Python script execution exceeded time limit
{
A python script took too long to execute and has been interrupted.
 < Python execution monitor
}
```

This happened because `subprocess.call` and `os.popen` blocked the main
thread waiting for `cmd.exe /c echo test` to return. Even that trivial
command took long enough to trigger the execution monitor. **Any blocking
spawn will hang Designer.**

## The ONLY safe pattern for spawning external processes

```python
import subprocess
import os

# WINDOWS-ONLY: detach the child process from Designer's stdio.
#
# CREATE_NO_WINDOW = 0x08000000 prevents a console window from popping up.
#
# Stdin/stdout/stderr to DEVNULL prevents the child from writing into
# Designer's console (which can hang if the buffer fills and the child
# blocks on a write).
#
# Python 2.7.18 does not have subprocess.DEVNULL — open os.devnull instead.

def _devnull(mode):
    if hasattr(subprocess, "DEVNULL"):
        return subprocess.DEVNULL
    return open(os.devnull, mode)

proc = subprocess.Popen(
    ["companion.exe", "--port", "38301"],
    creationflags=0x08000000,  # CREATE_NO_WINDOW
    stdout=_devnull("wb"),
    stderr=_devnull("wb"),
    stdin=_devnull("rb"),
    close_fds=True,
)

# Store proc.pid in plugin config so a future d3 exec invocation
# can look up and terminate the child via os.kill(pid, signal.SIGTERM).
companion_pid = proc.pid
```

Equivalent single-expression form if you prefer not to factor the helper:

```python
proc = subprocess.Popen(
    ["companion.exe", "--port", "38301"],
    creationflags=0x08000000,
    stdout=subprocess.DEVNULL if hasattr(subprocess, "DEVNULL") else open(os.devnull, "wb"),
    stderr=subprocess.DEVNULL if hasattr(subprocess, "DEVNULL") else open(os.devnull, "wb"),
    stdin=subprocess.DEVNULL if hasattr(subprocess, "DEVNULL") else open(os.devnull, "rb"),
    close_fds=True,
)
```

**Never** call `.wait()`, `.communicate()`, or read from `.stdout` on the
returned Popen. Those are blocking and will hang Designer's render thread.
Fire and forget; communicate with the child via a side channel (socket,
file, named pipe).

## Use cases

- **Companion app architecture**: plugin spawns a long-lived external .exe
  that owns any functionality the sandbox prohibits (background threads,
  custom UDP listeners, HTTP servers, file watchers). The plugin talks to
  the companion via `socket` on localhost.
- **External bridges**: OSC-to-anything translators, hardware control
  daemons, log shippers — anything that needs to outlive a single script
  execution.
- **One-shot utilities**: shelling out to ffmpeg, 7z, curl, etc. — but
  only if you can tolerate the child running with no stdout capture. If
  you need the child's output, write it to a file and read the file in a
  subsequent `d3 exec` call.

## Exception handling

Wrap the Popen in a bare `except:` — subprocess errors in the sandbox may
not subclass `Exception`. See `bare-except-required.md`:

```python
try:
    proc = subprocess.Popen(...)
except:
    # Do not use `except Exception` — sandbox errors may bypass it
    proc = None
```

## Related

- [sandbox-stdlib.md](sandbox-stdlib.md) — which stdlib modules are importable in the sandbox
- [bare-except-required.md](bare-except-required.md) — subprocess errors may not subclass Exception
