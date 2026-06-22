"""
Test the "update" event — change a node/edge color, size, and hidden state.

Update payload contract:
    {
        "id": "<node or edge id>",
        "elementType": "node" | "edge",
        "updates": { "color": <str|null>, "size": <num|null>, "hidden": <bool|null> }
    }
Any value in "updates" may be null to leave that property unchanged.

Loads socialExample.json first so there is something to update, then walks
through a few updates with pauses so you can watch them in the GLIMPSE UI.

    python socket-testing/test_update.py
"""

import json
import os

import common

SOCIAL_EXAMPLE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "testing",
    "models",
    "demo_examples",
    "socialExample.json",
)

# ids that exist in socialExample.json
NODE_ID = "John-Doe"
EDGE_ID = "JaneDoe-JohnDoe"


def main():
    sio = common.connect()
    try:
        with open(SOCIAL_EXAMPLE, "r") as f:
            common.call(sio, "load-graph", json.load(f))
        sio.sleep(1.5)

        # Recolor + enlarge a node (all three properties)
        print("\n[1] Node: red + larger")
        common.call(sio, "update", {
            "id": NODE_ID,
            "elementType": "node",
            "updates": {"color": "#ff0000", "size": 25, "hidden": False},
        })
        sio.sleep(1.5)

        # Partial update — only color changes, size/hidden left untouched (null)
        print("\n[2] Node: only color changes (size/hidden = null)")
        common.call(sio, "update", {
            "id": NODE_ID,
            "elementType": "node",
            "updates": {"color": "#1f77b4", "size": None, "hidden": None},
        })
        sio.sleep(1.5)

        # Hide then show the node
        print("\n[3] Node: hide, then show")
        common.call(sio, "update", {
            "id": NODE_ID,
            "elementType": "node",
            "updates": {"color": None, "size": None, "hidden": True},
        })
        sio.sleep(1.5)
        common.call(sio, "update", {
            "id": NODE_ID,
            "elementType": "node",
            "updates": {"color": None, "size": None, "hidden": False},
        })
        sio.sleep(1.5)

        # Update an edge's color + size
        print("\n[4] Edge: recolor + thicken")
        common.call(sio, "update", {
            "id": EDGE_ID,
            "elementType": "edge",
            "updates": {"color": "#e377c2", "size": 6, "hidden": None},
        })
        sio.sleep(1.5)

        # Malformed payloads should be rejected with an error ack
        print("\n[5] Invalid payloads (expecting error acks)")
        common.call(sio, "update", {"id": NODE_ID, "elementType": "widget", "updates": {}})
        common.call(sio, "update", {"elementType": "node", "updates": {"color": "#000"}})

        sio.sleep(1)
    finally:
        sio.disconnect()
        print("\nDone. Disconnected.")


if __name__ == "__main__":
    main()
