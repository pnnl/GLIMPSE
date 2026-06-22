"""
Test the "add-node", "add-edge", "delete-node", and "delete-edge" events.

Payloads use the same GLIMPSE object shape as load-graph:
    add-node: { "objectType", "elementType": "node", "attributes": { "id"|"name", ... } }
    add-edge: { "objectType", "elementType": "edge", "attributes": { "id"?, "from", "to", ... } }
    delete-node / delete-edge: the object id (a string)

Loads socialExample.json first, then adds a node + edge and removes them again,
with pauses so you can watch the graph change in the GLIMPSE UI.

    python socket-testing/test_add_delete.py
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

NEW_NODE_ID = "Tony-Stark"
EXISTING_NODE_ID = "John-Doe"  # exists in socialExample.json
NEW_EDGE_ID = "TonyStark-JohnDoe"


def main():
    sio = common.connect()
    try:
        with open(SOCIAL_EXAMPLE, "r") as f:
            common.call(sio, "load-graph", json.load(f))
        sio.sleep(1.5)

        # Add a new node
        print("\n[1] add-node")
        common.call(sio, "add-node", {
            "objectType": "person",
            "elementType": "node",
            "attributes": {
                "id": NEW_NODE_ID,
                "name": "Tony Stark",
                "fname": "Tony",
                "lname": "Stark",
                "age": 48,
            },
        })
        sio.sleep(1.5)

        # Connect the new node to an existing one
        print("\n[2] add-edge (new node -> existing node)")
        common.call(sio, "add-edge", {
            "objectType": "friend",
            "elementType": "edge",
            "attributes": {
                "id": NEW_EDGE_ID,
                "from": NEW_NODE_ID,
                "to": EXISTING_NODE_ID,
                "relationship": "Acquaintance",
            },
        })
        sio.sleep(2)

        # add-edge to a missing endpoint should be rejected by the frontend
        # (the backend forwards it; GraphHelper validates the endpoints exist).
        print("\n[3] add-edge with a missing endpoint (server acks; frontend ignores)")
        common.call(sio, "add-edge", {
            "objectType": "friend",
            "elementType": "edge",
            "attributes": {"id": "bad-edge", "from": NEW_NODE_ID, "to": "Does-Not-Exist"},
        })
        sio.sleep(1)

        # Remove the edge, then the node
        print("\n[4] delete-edge")
        common.call(sio, "delete-edge", NEW_EDGE_ID)
        sio.sleep(1.5)

        print("\n[5] delete-node")
        common.call(sio, "delete-node", NEW_NODE_ID)
        sio.sleep(1.5)

        # Empty ids should be rejected with an error ack
        print("\n[6] Invalid deletes (expecting error acks)")
        common.call(sio, "delete-node", "")
        common.call(sio, "delete-edge", "")

        sio.sleep(1)
    finally:
        sio.disconnect()
        print("\nDone. Disconnected.")


if __name__ == "__main__":
    main()
