# GLIMPSE Socket API — Test Scripts

These scripts act as an **external client** for the GLIMPSE SocketIO backend.
They connect to the server and emit the events that let an outside script load
and manipulate whatever graph the connected GLIMPSE frontends are showing.

The backend validates each payload, then **broadcasts** it to every connected
client, so the scripts also listen for the rebroadcast and print it — you get
confirmation even with no browser open.

> **Writing your own scripts?** See [`EVENTS_API.md`](EVENTS_API.md) for the full
> event contract — payload shapes, field references, the data model, and example
> clients in Python and JavaScript.

## Events covered

| Event | Payload | Purpose |
|-------|---------|---------|
| `load-graph` | GLIMPSE objects format **or** NetworkX `node_link_data` output | Replace the visualized graph |
| `update` | `{ id, elementType: "node"\|"edge", updates: { color, size, hidden } }` | Restyle one object (any update value may be `null` = unchanged) |
| `add-node` | `{ objectType, elementType: "node", attributes: { id\|name, ... } }` | Add a node |
| `add-edge` | `{ objectType, elementType: "edge", attributes: { id?, from, to, ... } }` | Add an edge (endpoints must exist) |
| `delete-node` | node id (string) | Remove a node + its edges |
| `delete-edge` | edge id (string) | Remove an edge |

Every event returns an **ack**: `{ "status": "ok", ... }` or `{ "error": "..." }`.

## Setup

```bash
pip install -r socket-testing/requirements.txt
```

Start the backend (and, to watch the effects, the frontend):

```bash
npm run dev          # backend + frontend
# or just the backend:
npm run dev:backend
```

The backend listens on `http://127.0.0.1:5052` by default. Point the scripts
elsewhere with the `GLIMPSE_SERVER_URL` env var.

## Run

```bash
python socket-testing/test_load_graph.py   # load-graph: GLIMPSE + NetworkX forms
python socket-testing/test_update.py       # update: color / size / hidden
python socket-testing/test_add_delete.py   # add-node, add-edge, delete-node, delete-edge
python socket-testing/test_all.py          # full sequence in one connection
```

Tips:
- Open the GLIMPSE frontend (it connects over the same socket) to watch each
  change render live. The scripts pause between steps for this reason.
- `FAST=1 python socket-testing/test_all.py` removes the pauses.
- `GLIMPSE_SERVER_URL=http://host:port python socket-testing/test_all.py`
  targets a different backend.

## Files

- `common.py` — shared connect/emit helpers and broadcast loggers.
- `test_load_graph.py` — both `load-graph` payload forms + an invalid payload.
- `test_update.py` — full, partial (`null`), and hide/show updates for a node and an edge.
- `test_add_delete.py` — add then remove a node and an edge.
- `test_all.py` — every event exercised in one run.
