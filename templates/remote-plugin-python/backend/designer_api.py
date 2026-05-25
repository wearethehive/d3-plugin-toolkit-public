# d3-check: external-python
from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict


def execute_python(host: str, port: int, script: str, timeout: float = 5.0) -> Dict[str, Any]:
    """Execute a small Python script through Designer's HTTP execution API."""
    url = "http://{0}:{1}/api/session/python/execute".format(host, port)
    payload = json.dumps({"script": script}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def check_designer(host: str, port: int) -> Dict[str, Any]:
    """Return a JSON-safe Designer connectivity result."""
    try:
        result = execute_python(host, port, "return 'connected'")
    except urllib.error.URLError as exc:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "message": str(exc.reason),
        }
    except Exception as exc:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "message": str(exc),
        }

    status = result.get("status", {})
    ok = status.get("code") == 0
    return {
        "ok": ok,
        "host": host,
        "port": port,
        "message": status.get("message") or ("connected" if ok else "unknown status"),
    }

