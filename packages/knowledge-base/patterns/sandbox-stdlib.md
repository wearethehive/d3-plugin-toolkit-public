---
type: pattern
status: confirmed
tested: "2026-04-07"
---

# Python Sandbox Standard Library Availability

The Designer Python sandbox uses a restricted import hook (see
`C:\blip\dev\scripts\restrictedscope\import_hook.py`) that allows only a
specific subset of stdlib modules. This list is load-bearing for any plugin
considering custom networking, threading, or filesystem code.

## Allowed

| Module | Status | Notes |
|---|---|---|
| `socket` | ✅ | UDP/TCP sockets reachable at the syscall level |
| `select` | ✅ | Non-blocking IO multiplex |
| `struct` | ✅ | Binary packet pack/unpack (e.g. OSC decoding) |
| `json` | ✅ | |
| `os` | ✅ | `os.getcwd()`, `os.listdir()` work; CWD is Designer's, not the project |
| `time` | ✅ | |
| `ctypes` | ✅ | |
| `subprocess` | ✅ | Importable; see [subprocess-from-sandbox.md](subprocess-from-sandbox.md) |
| `subprocess.Popen` | ✅ | Non-blocking process spawn — the ONLY safe way to shell out |

## Blocked

| Module | Status | Implication |
|---|---|---|
| `threading` | ❌ | **No background threads.** Custom long-running listeners (UDP, etc.) are infeasible from one-shot scripts. |
| `asyncio` | ❌ | No event loop |
| `sys` | ❌ | Strict — most introspection unavailable |

## Implications for plugins

Designer Python is a one-shot execution model: every `d3 exec` is a fresh
script. Combined with no `threading`, this means **you cannot run a
persistent custom server** (UDP, HTTP, OSC) from a plugin's Python module.
Long-running listeners must use one of:

1. Designer-native primitives that already host their own listeners
   (`OscDevice`, MIDI inputs, video inputs, etc.)
2. A registered Module subclass that runs in Designer's render loop —
   risky, see `bugs/registermodule-import-d3.md`
3. The plugin frontend polling via repeated `d3 exec` calls

For OSC specifically: use `OscDevice` (the runtime UDP listener Designer
already provides) and bind values into an `OscControlModule` whose
variables can be observed via the LiveUpdate WebSocket.

## Subprocess and process spawning

`subprocess` is importable and `subprocess.Popen` works for spawning
external processes from the sandbox — but **only the non-blocking,
fully-detached form is safe**. Full details, the only safe Popen
invocation pattern, and the rationale are in
[subprocess-from-sandbox.md](subprocess-from-sandbox.md).

> ⚠️ **BLOCKING CALL WARNING**
>
> Designer's Python runs on the main render thread. Any blocking
> subprocess call hangs the render loop and will be killed by Designer's
> execution monitor (~4 second limit observed). Use `subprocess.Popen`
> (non-blocking) **ONLY**, never `subprocess.call` / `subprocess.run` /
> `os.system` / `os.popen`. Never call `.wait()`, `.communicate()`, or
> read from `.stdout` on the returned Popen — those are blocking too.

## Gotcha: import hook errors are not Exception subclasses

When `__import__("threading")` fails inside the sandbox, the raised error
is not caught by `except Exception:`. Use bare `except:` per
`bare-except-required.md`. The first version of this probe died on this
exact issue.
