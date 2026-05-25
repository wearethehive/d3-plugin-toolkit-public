# d3-check: external-python
from __future__ import annotations

import argparse
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

from designer_api import check_designer


PLUGIN_NAME = "{{pluginName}}"
PLUGIN_VERSION = "0.1.0"


def load_config(root: Path) -> Dict[str, Any]:
    config_path = root / "remote-plugin.config.json"
    if not config_path.exists():
      return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


class RemotePluginServer(ThreadingHTTPServer):
    def __init__(self, address, handler, *, root: Path, static_dir: Optional[Path], config: Dict[str, Any]):
        super().__init__(address, handler)
        self.root = root
        self.static_dir = static_dir
        self.config = config


class Handler(BaseHTTPRequestHandler):
    server: RemotePluginServer

    def log_message(self, format: str, *args: object) -> None:
        print("[remote-plugin] " + format % args)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json({
                "ok": True,
                "name": PLUGIN_NAME,
                "backend": "python",
                "version": PLUGIN_VERSION,
            })
            return

        if parsed.path == "/api/designer/status":
            query = parse_qs(parsed.query)
            host = query.get("host", [self.server.config.get("designerHost", "127.0.0.1")])[0]
            port = int(query.get("port", [self.server.config.get("designerPort", 80)])[0])
            self.send_json(check_designer(host, port))
            return

        self.serve_static(parsed.path)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def serve_static(self, route_path: str) -> None:
        static_dir = self.server.static_dir
        if static_dir is None:
            self.send_json({"ok": False, "message": "No static directory configured"}, status=404)
            return

        relative = route_path.lstrip("/") or "index.html"
        target = (static_dir / relative).resolve()
        if not str(target).startswith(str(static_dir.resolve())):
            self.send_json({"ok": False, "message": "Invalid path"}, status=400)
            return

        if target.is_dir():
            target = target / "index.html"
        if not target.exists():
            target = static_dir / "index.html"
        if not target.exists():
            self.send_json({"ok": False, "message": "Static frontend not built"}, status=404)
            return

        body = target.read_bytes()
        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run {{title}} remote plugin backend")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--static", default=None, help="Static frontend dist directory")
    parser.add_argument("--publish", action="store_true", help="Publish via DNS-SD using designer-plugin")
    parser.add_argument("--publish-port", type=int, default=None, help="Port for the published web UI")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    root = Path(__file__).resolve().parents[1]
    config = load_config(root)
    host = args.host or config.get("host", "127.0.0.1")
    port = args.port or int(config.get("backendPort", 38301))
    static_dir = Path(args.static).resolve() if args.static else None
    publish_port = args.publish_port or port

    os.chdir(str(root))
    server = RemotePluginServer((host, port), Handler, root=root, static_dir=static_dir, config=config)
    print("[remote-plugin] backend listening on http://{0}:{1}".format(host, port))

    if args.publish:
        from publisher import publish_plugin

        with publish_plugin(publish_port):
            print("[remote-plugin] published {{title}} on port {0}".format(publish_port))
            server.serve_forever()
    else:
        server.serve_forever()


if __name__ == "__main__":
    main()

