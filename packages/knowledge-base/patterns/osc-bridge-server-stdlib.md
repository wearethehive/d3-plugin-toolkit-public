---
type: pattern
status: observed
tested: "2026-05-03"
scope: plugin-frontend
api_coverage:
  - name: "pythonw OSC bridge"
    match: "pythonw\\.exe|BaseHTTPServer|socketserver|#bundle|WSAECONNRESET|text/event-stream"
    related_files: ["osc-bridge-server-stdlib.md", "subprocess-from-sandbox.md", "sandbox-stdlib.md"]
    required: false
---

# OSC Bridge Server With Stdlib Python

## Purpose

Run a standalone CPython process that listens for OSC UDP packets and forwards
them to a Vue plugin over HTTP and Server-Sent Events, without `flask`,
`python-osc`, or other external packages.

This is for an external `pythonw.exe` process, not for Designer's restricted
Python sandbox. The Designer-side launcher should still follow
[subprocess-from-sandbox.md](subprocess-from-sandbox.md).

## Why This Exists

Dependency-based bridge processes are fragile on offline show machines. The
portable pattern is to keep the companion bridge to Python standard-library
modules:

- UDP receive via `socket.recvfrom`
- HTTP/SSE via `BaseHTTPServer` / `http.server`
- thread handling via `SocketServer.ThreadingMixIn` / `socketserver.ThreadingMixIn`
- OSC parsing via `struct.unpack`

## Python 2.7 Source Rules

If the external `pythonw.exe` is Python 2.7, any non-ASCII byte in a source file
without an encoding declaration can cause startup `SyntaxError` before logging
works.

Use this header for any bridge file that might run under Python 2.7:

```python
# -*- coding: utf-8 -*-
from __future__ import print_function
```

Avoid type annotations and Python 3-only `print(..., flush=True)` usage. Use:

```python
sys.stdout.write(str(message) + "\n")
sys.stdout.flush()
```

## Compatibility Imports

```python
try:
    import queue
except ImportError:
    import Queue as queue

try:
    import socketserver
    from http.server import BaseHTTPRequestHandler
except ImportError:
    import SocketServer as socketserver
    from BaseHTTPServer import BaseHTTPRequestHandler

try:
    string_types = (str, unicode)
except NameError:
    string_types = (str,)
```

## SSE Requirement

Set HTTP/1.1 explicitly. Some HTTP/1.0 paths buffer streaming responses until
the connection closes, which means SSE events never arrive.

```python
class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
```

## Windows UDP Reset Guard

On Windows, ICMP "port unreachable" can surface as `socket.error` errno 10054
from `recvfrom()`. Treat it as transient so the receive loop keeps listening.

```python
try:
    data, addr = sock.recvfrom(65536)
except Exception as exc:
    text = str(exc)
    if "10054" in text or "WSAECONNRESET" in text.upper():
        continue
    raise
```

## OSC Bundles

Professional OSC tools often send bundles. Dispatch on the bundle magic before
single-message parsing:

```python
if data[:8] == b"#bundle\x00":
    for address, args in parse_osc_bundle(data):
        handle_osc(address, args)
else:
    parsed = parse_osc_packet(data)
    if parsed is not None:
        handle_osc(parsed[0], parsed[1])
```

The parser should support at least `i`, `f`, `s`, `T`, `F`, `N`, and `I`. Fixed
width types such as `d`, `h`, `t`, `m`, and `c` can be skipped by width if the
bridge does not need their values.

## Shutdown

Respond before terminating:

```python
def handle_shutdown():
    send_json(200, {"ok": True})

    def exit_later():
        time.sleep(0.1)
        os._exit(0)

    t = threading.Thread(target=exit_later)
    t.daemon = True
    t.start()
```

`os._exit(0)` is acceptable for a single-purpose bridge process because it
avoids finalization hangs after the HTTP response has flushed.
