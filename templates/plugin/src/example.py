__all__ = ["get_status", "get_track_info"]

import json


def get_status():
    """Return basic Designer connection status."""
    result = {
        "connected": True,
        "track": str(guisystem.track.description),
    }
    return json.dumps(result)


def get_track_info():
    """Return track layers and timing info."""
    track = guisystem.track
    track_desc = str(track.description)
    suffix = " in track %s" % track_desc
    layers = []
    for i in range(len(track.layers)):
        layer = track.layers[i]
        nm = str(layer.description)
        if nm.endswith(suffix):
            nm = nm[:-len(suffix)]
        layers.append({"name": nm, "uid": str(layer.uid)})
    return json.dumps({"track": track_desc, "layers": layers})
