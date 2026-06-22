"""
Test the "load-graph" event in both supported forms:

  1. GLIMPSE objects format  (the same shape as socialExample.json)
  2. NetworkX node-link data dump  (nx.node_link_data output)

Run the GLIMPSE frontend alongside this to watch each graph render.

    python socket-testing/test_load_graph.py
"""

import json
import os

import networkx as nx

import common

SOCIAL_EXAMPLE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "testing",
    "models",
    "demo_examples",
    "socialExample.json",
)


def build_networkx_graph():
    """A small typed social graph so the node/edge types show up in GLIMPSE."""
    g = nx.Graph()
    g.add_node("Ada", type="person", name="Ada Lovelace", role="Mathematician")
    g.add_node("Alan", type="person", name="Alan Turing", role="Computer Scientist")
    g.add_node("Grace", type="person", name="Grace Hopper", role="Rear Admiral")
    g.add_node("Bletchley", type="location", name="Bletchley Park")

    g.add_edge("Ada", "Alan", type="influence", relationship="Inspired")
    g.add_edge("Alan", "Grace", type="colleague", relationship="Peers")
    g.add_edge("Alan", "Bletchley", type="worked_at", relationship="Codebreaking")

    # NetworkX >=3.6 emits the edge list under "edges"; older releases use
    # "links". The backend handles both — see jsonhelper._node_link_to_objects.
    return nx.node_link_data(g)


def main():
    sio = common.connect()
    try:
        # 1) GLIMPSE objects format
        with open(SOCIAL_EXAMPLE, "r") as f:
            social_graph = json.load(f)
        print("\n[1/2] Loading GLIMPSE objects format (socialExample.json)")
        common.call(sio, "load-graph", social_graph)

        sio.sleep(2)  # pause so you can see it in the UI before it's replaced

        # 2) NetworkX node-link format
        print("\n[2/2] Loading NetworkX node-link data dump")
        common.call(sio, "load-graph", build_networkx_graph())

        # 3) An invalid payload should be rejected with an error ack
        print("\n[extra] Sending an invalid payload (expecting an error ack)")
        common.call(sio, "load-graph", {"not": "a graph"})

        sio.sleep(1)
    finally:
        sio.disconnect()
        print("\nDone. Disconnected.")


if __name__ == "__main__":
    main()
