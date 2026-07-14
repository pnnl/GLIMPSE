"""
Run the full GLIMPSE external-socket API demo end to end, in one connection:

    load-graph (NetworkX) -> add-node -> add-edge -> update -> delete-edge -> delete-node

Open the GLIMPSE frontend first so you can watch each step. Pauses between
steps are intentional; set FAST=1 to skip them.

    python socket-testing/test_all.py
"""

import os

import networkx as nx

import common

PAUSE = 0 if os.environ.get("FAST") else 2


def build_graph():
    g = nx.Graph()
    g.add_node("Ada", type="person", name="Ada Lovelace")
    g.add_node("Alan", type="person", name="Alan Turing")
    g.add_node("Grace", type="person", name="Grace Hopper")
    g.add_edge("Ada", "Alan", type="influence", relationship="Inspired")
    g.add_edge("Alan", "Grace", type="colleague", relationship="Peers")
    return nx.node_link_data(g)


def main():
    sio = common.connect()
    try:
        print("\n=== load-graph (NetworkX node-link) ===")
        common.call(sio, "load-graph", build_graph())
        sio.sleep(PAUSE)

        print("\n=== add-node ===")
        common.call(sio, "add-node", {
            "objectType": "person",
            "elementType": "node",
            "attributes": {"id": "Katherine", "name": "Katherine Johnson"},
        })
        sio.sleep(PAUSE)

        print("\n=== add-edge ===")
        common.call(sio, "add-edge", {
            "objectType": "colleague",
            "elementType": "edge",
            "attributes": {"id": "Katherine-Grace", "from": "Katherine", "to": "Grace"},
        })
        sio.sleep(PAUSE)

        print("\n=== update (node color + size) ===")
        common.call(sio, "update", {
            "id": "Katherine",
            "elementType": "node",
            "updates": {"color": "#2ca02c", "size": 22, "hidden": None},
        })
        sio.sleep(PAUSE)

        print("\n=== update (edge color) ===")
        common.call(sio, "update", {
            "id": "Katherine-Grace",
            "elementType": "edge",
            "updates": {"color": "#ff7f0e", "size": 5, "hidden": None},
        })
        sio.sleep(PAUSE)

        print("\n=== delete-edge ===")
        common.call(sio, "delete-edge", "Katherine-Grace")
        sio.sleep(PAUSE)

        print("\n=== delete-node ===")
        common.call(sio, "delete-node", "Katherine")
        sio.sleep(PAUSE)

        print("\nAll events exercised.")
    finally:
        sio.disconnect()
        print("Disconnected.")


if __name__ == "__main__":
    main()
