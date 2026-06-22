"""
Shared helpers for the GLIMPSE socket API test scripts.

These scripts act as an "external client": they connect to the GLIMPSE
SocketIO backend and emit the events that drive any connected frontend
(load-graph / update / add-node / add-edge / delete-node / delete-edge).

The backend broadcasts each event back out to every connected client, so we
register listeners here too — that way the scripts can confirm what a frontend
would receive, even when no browser is open.

Set GLIMPSE_SERVER_URL to point at a non-default backend, e.g.:
    GLIMPSE_SERVER_URL=http://127.0.0.1:5052 python test_load_graph.py
"""

import os
import sys

import socketio

DEFAULT_URL = os.environ.get("GLIMPSE_SERVER_URL", "http://127.0.0.1:5052")


def _obj_id(data):
    """Pull a readable id out of an add-node / add-edge payload."""
    if isinstance(data, dict):
        return data.get("attributes", {}).get("id")
    return data


def _register_broadcast_loggers(sio):
    """Log the events the server relays back to all connected clients."""

    @sio.on("load-graph")
    def _on_load_graph(payload):
        data = payload.get("data", payload) if isinstance(payload, dict) else payload
        count = 0
        if isinstance(data, dict):
            for f in data.values():
                if isinstance(f, dict):
                    count += len(f.get("objects", []))
        print(f"   broadcast 'load-graph' received ({count} objects)")

    @sio.on("update-data")
    def _on_update(data):
        print(f"   broadcast 'update-data' received: {data}")

    @sio.on("add-node")
    def _on_add_node(data):
        print(f"   broadcast 'add-node' received: id={_obj_id(data)}")

    @sio.on("add-edge")
    def _on_add_edge(data):
        print(f"   broadcast 'add-edge' received: id={_obj_id(data)}")

    @sio.on("delete-node")
    def _on_del_node(data):
        print(f"   broadcast 'delete-node' received: {data}")

    @sio.on("delete-edge")
    def _on_del_edge(data):
        print(f"   broadcast 'delete-edge' received: {data}")


def connect(url=DEFAULT_URL, log_broadcasts=True):
    """Create + connect a SocketIO client, exiting with a helpful message on failure."""
    sio = socketio.Client(logger=False, engineio_logger=False)

    if log_broadcasts:
        _register_broadcast_loggers(sio)

    try:
        sio.connect(url)
    except Exception as e:  # socketio.exceptions.ConnectionError and friends
        print(f"FAIL  Could not connect to {url}: {e}")
        print("      Is the GLIMPSE backend running?  ->  npm run dev:backend")
        sys.exit(1)

    print(f"OK    Connected to {url}  (sid={sio.sid})")
    return sio


def call(sio, event, data, timeout=10):
    """Emit `event` with an ack and pretty-print the server's response."""
    print(f"\n--> emit '{event}'")
    try:
        ack = sio.call(event, data, timeout=timeout)
    except socketio.exceptions.TimeoutError:
        print(f"    FAIL  no ack within {timeout}s")
        return None

    if isinstance(ack, dict) and ack.get("error"):
        print(f"    FAIL  server error: {ack['error']}")
    else:
        print(f"    OK    ack: {ack}")

    # Give the background thread a moment to surface the broadcast log line.
    sio.sleep(0.4)
    return ack
