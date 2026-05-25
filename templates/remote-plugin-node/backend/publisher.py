# d3-check: external-python
from __future__ import annotations

from contextlib import contextmanager
from time import sleep
from typing import Iterator


@contextmanager
def publish_plugin(port: int) -> Iterator[object]:
    """Publish the plugin through the official designer-plugin library."""
    try:
        from designer_plugin import DesignerPlugin
    except ImportError as exc:
        raise RuntimeError(
            "designer-plugin is not installed. Run: python -m pip install -r backend/requirements.txt"
        ) from exc

    with DesignerPlugin.default_init(port) as plugin:
        yield plugin


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Publish {{title}} via DNS-SD")
    parser.add_argument("--port", type=int, required=True, help="Port of the web UI Designer should open")
    args = parser.parse_args()

    with publish_plugin(args.port):
        print("[remote-plugin] published {{title}} on port {0}".format(args.port))
        try:
            while True:
                sleep(3600)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

