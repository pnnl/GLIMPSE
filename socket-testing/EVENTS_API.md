# GLIMPSE Socket Events API

GLIMPSE runs a [SocketIO](https://socket.io/) server alongside its HTTP backend.
External scripts can connect to it to **load graphs** and **update the live
visualization** — adding, removing, restyling, hiding, and showing nodes and
edges in any connected GLIMPSE frontend.

This document is the contract for those events: what to emit, what shape the data
must take, and what you get back.

> Working examples for every event live next to this file in
> [`socket-testing/`](.). Start with [`test_all.py`](test_all.py).

## Table of contents

- [How it works](#how-it-works)
- [Connecting](#connecting)
- [Conventions](#conventions)
- [Events](#events)
  - [`load-graph`](#load-graph)
  - [`update`](#update)
  - [`add-node`](#add-node)
  - [`add-edge`](#add-edge)
  - [`delete-node`](#delete-node)
  - [`delete-edge`](#delete-edge)
- [Data model reference](#data-model-reference)
  - [GLIMPSE object format](#glimpse-object-format)
  - [NetworkX node-link format](#networkx-node-link-format)
  - [Object ids](#object-ids)
  - [Styling & themes](#styling--themes)
- [Full client examples](#full-client-examples)
- [Common pitfalls](#common-pitfalls)
- [Quick reference](#quick-reference)

---

## How it works

```
                emit "add-node"            broadcast "add-node"
  your script  ───────────────▶  GLIMPSE  ───────────────▶  every connected
   (a client)  ◀───────────────   server   ───────────────▶  GLIMPSE frontend
                  ack {status}              broadcast "add-node"
                                            (incl. back to your script)
```

1. Your script connects to the server as a SocketIO client.
2. It **emits** an event (e.g. `update`) with a JSON payload.
3. The server **validates** the payload and replies with an **ack**.
4. The server **broadcasts** the event to *all* connected clients. Every GLIMPSE
   frontend applies it to its current graph.

Because the server broadcasts to everyone, your script also receives the events
it sends. That's useful for confirmation — see the broadcast loggers in
[`common.py`](common.py).

> **The ack confirms the server accepted and broadcast the event — not that a
> frontend applied it.** Frontends silently ignore operations that reference
> objects that don't exist in their current graph (a console warning is logged).
> See [Common pitfalls](#common-pitfalls).

---

## Connecting

| | |
|---|---|
| **Default URL** | `http://127.0.0.1:5052` |
| **Transport** | WebSocket (falls back to HTTP long-polling) |
| **Path** | `/socket.io` (the default) |

The port is configurable on the backend via `FLASK_PORT`. In the Docker setup the
backend is exposed on `5052`.

**Python** (`pip install "python-socketio[client]"`):

```python
import socketio
sio = socketio.Client()
sio.connect("http://127.0.0.1:5052")
```

**Browser / Node** (`socket.io-client`):

```js
import { io } from "socket.io-client";
const socket = io("http://127.0.0.1:5052");
```

> **CORS (browser only):** the backend restricts allowed origins. For a browser
> script, serve it from an allowed origin (e.g. `http://localhost:5173`) or set
> the backend's `CORS_ORIGINS` env var (comma-separated list, or `*`). Non-browser
> clients (Python, Node scripts) are not subject to CORS.

---

## Conventions

- **Acks.** Every event replies with a JSON ack. Request one with
  `sio.call(...)` (Python) or an emit callback (JS):
  - Success: `{ "status": "ok" }` (some events add fields, e.g. `objectCount`).
  - Failure: `{ "error": "<message>" }`.
- **Object ids are strings.** Node/edge ids are matched as strings. Numeric ids
  (e.g. from a NetworkX integer-labeled graph) are converted to strings on load,
  so reference them as strings (`"0"`, not `0`) in later events.
- **Operations target the *current* graph.** `update`, `add-edge`, `delete-*`
  act on whatever graph is loaded. Load a graph first.

---

## Events

### `load-graph`

Replace the visualized graph. Accepts **either** the GLIMPSE objects format
**or** a NetworkX node-link data dump — the server detects which and normalizes it.

**Emit payload** — one of:

GLIMPSE objects format (see [socialExample.json](../testing/models/demo_examples/socialExample.json)):

```json
{
  "objects": [
    { "objectType": "person", "elementType": "node",
      "attributes": { "id": "John-Doe", "fname": "John", "age": 33 } },
    { "objectType": "friend", "elementType": "edge",
      "attributes": { "id": "Jane-John", "from": "Jane-Doe", "to": "John-Doe" } }
  ]
}
```

NetworkX node-link format (`networkx.node_link_data(G)` output):

```json
{
  "directed": false, "multigraph": false, "graph": {},
  "nodes": [ { "id": "A", "type": "person", "name": "A" } ],
  "edges": [ { "source": "A", "target": "B", "type": "friend" } ]
}
```

**Ack:** `{ "status": "ok", "objectCount": <int> }` or `{ "error": "<message>" }`.

**Behavior:** clears any existing graph and renders the new one. Unknown node/edge
types are auto-assigned a color (see [Styling & themes](#styling--themes)).

---

### `update`

Restyle a single node or edge — change its **color**, **size**, and/or
**hidden** state.

**Emit payload:**

```json
{
  "id": "John-Doe",
  "elementType": "node",
  "updates": { "color": "#ff0000", "size": 25, "hidden": false }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | The node or edge id (**required**). |
| `elementType` | `"node"` \| `"edge"` | Which kind of object (**required**). |
| `updates.color` | string \| `null` | Hex (`"#ff0000"`) or rgba (`"rgba(255,0,0,0.7)"`). `null` = leave unchanged. |
| `updates.size` | number \| `null` | Node radius or edge thickness. `null` = leave unchanged. |
| `updates.hidden` | boolean \| `null` | `true` hides the object, `false` shows it. `null` = leave unchanged. |

> Send only the properties you want to change; set the others to `null`. Example —
> recolor without resizing: `"updates": { "color": "#1f77b4", "size": null, "hidden": null }`.

**Ack:** `{ "status": "ok" }`, or `{ "error": ... }` if `id`/`elementType` are
missing or `elementType` isn't `"node"`/`"edge"`.

> **Switch/specialized edges:** edges drawn with a special renderer (e.g. power-grid
> `switch` edges) use a separate marker color; `update`'s `color` affects the line,
> not that marker.

---

### `add-node`

Add a node to the current graph. Uses the same object shape as `load-graph`.

**Emit payload:**

```json
{
  "objectType": "person",
  "elementType": "node",
  "attributes": { "id": "Tony-Stark", "name": "Tony Stark", "age": 48 }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `objectType` | string | Type/group name; drives styling. Defaults to `"node"`. |
| `elementType` | `"node"` | Optional but recommended. |
| `attributes.id` *or* `attributes.name` | string | **Required** — used as the node id (`id` preferred). |
| `attributes.x`, `attributes.y` | number | Optional fixed coordinates. Omit to drop it at the graph center. |
| `attributes.*` | any | Any extra fields are kept and shown in the node's tooltip. |

**Ack:** `{ "status": "ok" }` (server requires an `attributes` object).

**Frontend rules:** ignored if a node with that id already exists. A previously
unseen `objectType` is auto-assigned a color.

---

### `add-edge`

Add an edge between two **existing** nodes.

**Emit payload:**

```json
{
  "objectType": "friend",
  "elementType": "edge",
  "attributes": { "id": "Tony-John", "from": "Tony-Stark", "to": "John-Doe",
                  "relationship": "Acquaintance" }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `objectType` | string | Edge type/group; drives styling. Defaults to `"edge"`. |
| `elementType` | `"edge"` | Optional but recommended. |
| `attributes.from` | string | **Required** — source node id (must exist). |
| `attributes.to` | string | **Required** — target node id (must exist). |
| `attributes.id` | string | Optional edge id. Defaults to `"<from>-><to>"`. Use it for later `update`/`delete-edge`. |
| `attributes.*` | any | Extra fields are kept and shown in the edge's tooltip. |

**Ack:** `{ "status": "ok" }` (server requires an `attributes` object).

**Frontend rules:** ignored if either endpoint is missing, or if an edge with
that id already exists. A previously unseen `objectType` is auto-assigned a color.

---

### `delete-node`

Remove a node **and all of its connected edges**.

**Emit payload:** the node id as a string.

```json
"Tony-Stark"
```

**Ack:** `{ "status": "ok" }`, or `{ "error": ... }` for an empty id.
Ignored by the frontend if the node doesn't exist.

---

### `delete-edge`

Remove a single edge.

**Emit payload:** the edge id as a string.

```json
"Tony-John"
```

**Ack:** `{ "status": "ok" }`, or `{ "error": ... }` for an empty id.
Ignored by the frontend if the edge doesn't exist.

---

## Data model reference

### GLIMPSE object format

A GLIMPSE graph is `{ "objects": [ ... ] }`, where each object is a node or edge:

```jsonc
{
  "objectType": "person",      // type/group name — controls styling & the legend
  "elementType": "node",       // "node" or "edge"
  "attributes": { /* ... */ }  // id/name (nodes) or from/to (edges) + free-form data
}
```

**Nodes** — `attributes` must include `id` (preferred) or `name`. Everything in
`attributes` is shown in the node's hover tooltip. Optional `x`/`y` pin the node.

**Edges** — `attributes` must include `from` and `to` (node ids). `id` is optional
(defaults to `"<from>-><to>"`). Other fields are kept and shown in the tooltip.

### NetworkX node-link format

Pass `networkx.node_link_data(G)` straight to `load-graph`. The server maps it to
GLIMPSE objects:

| NetworkX | GLIMPSE | Notes |
|----------|---------|-------|
| `nodes[].id` | node id (`attributes.id`) | Coerced to a string. |
| `nodes[].type` | `objectType` | String, or a `{ "path": [...] }` dict joined with `-`. Defaults to `"node"`. |
| other `nodes[]` keys | `attributes.*` | Carried over. |
| `edges[]` / `links[]` | edges | `edges` (NetworkX ≥ 3.6) or `links` (older) — both accepted. |
| `edges[].source` / `.target` | `attributes.from` / `.to` | Coerced to strings. |
| `edges[].type` | `objectType` | Defaults to `"edge"`. |
| `edges[].key` | part of the edge id | Multigraphs only → id is `"<source>-<target>-<key>"`, otherwise `"<source>-<target>"`. |
| other `edges[]` keys | `attributes.*` | Carried over. |

A payload is treated as node-link when it has `directed`, `multigraph`, `nodes`,
and either `edges` or `links`. Otherwise it's validated as GLIMPSE objects format.

### Object ids

The id you use in `update`, `delete-node`, and `delete-edge` is the id GLIMPSE
assigned when the object was created:

- **Node id** = `attributes.id` if present, else `attributes.name`.
- **Edge id** = `attributes.id` if present, else `"<from>-><to>"`.
- For NetworkX loads, ids are as described in the mapping table above (and always
  strings — reference integer-labeled nodes as `"0"`, `"1"`, …).

### Styling & themes

When a graph loads, GLIMPSE applies its default **Power Grid** theme. Any
`objectType` it doesn't recognize is automatically given a color, so arbitrary
domains (social graphs, etc.) just work. To opt into power-grid styling, use the
known group names (e.g. `node`, `load`, `capacitor`, `switch`, `overhead_line`,
`transformer`, `regulator`, …); the `switch` edge type renders with its own
marker. `update` lets you override color/size per object regardless of type.

---

## Full client examples

### Python

```python
import socketio, networkx as nx

sio = socketio.Client()
sio.connect("http://127.0.0.1:5052")

# 1) Load a NetworkX graph
G = nx.karate_club_graph()
print(sio.call("load-graph", nx.node_link_data(G)))   # {'status': 'ok', 'objectCount': ...}

# 2) Add a node and connect it
sio.call("add-node", {
    "objectType": "person", "elementType": "node",
    "attributes": {"id": "New", "name": "New Person"},
})
sio.call("add-edge", {
    "objectType": "knows", "elementType": "edge",
    "attributes": {"id": "New-0", "from": "New", "to": "0"},
})

# 3) Restyle: recolor + enlarge the new node (leave hidden unchanged)
sio.call("update", {
    "id": "New", "elementType": "node",
    "updates": {"color": "#ff0000", "size": 18, "hidden": None},
})

# 4) Clean up
sio.call("delete-edge", "New-0")
sio.call("delete-node", "New")

sio.disconnect()
```

### Browser / Node (socket.io-client)

```js
import { io } from "socket.io-client";
const socket = io("http://127.0.0.1:5052");

socket.emit(
  "load-graph",
  { objects: [
      { objectType: "person", elementType: "node", attributes: { id: "A", name: "A" } },
      { objectType: "person", elementType: "node", attributes: { id: "B", name: "B" } },
      { objectType: "friend", elementType: "edge", attributes: { id: "A-B", from: "A", to: "B" } },
  ] },
  (ack) => console.log(ack)   // { status: "ok", objectCount: 3 }
);

socket.emit("update", {
  id: "A", elementType: "node",
  updates: { color: "#2ca02c", size: 20, hidden: null },
});
```

---

## Common pitfalls

- **`status: ok` but nothing changed.** The ack means the server broadcast the
  event; the frontend still ignores it if the target id doesn't exist. Check ids,
  and make sure a graph is loaded first.
- **Numeric ids.** NetworkX integer node labels become strings on load. Use
  `"0"`, not `0`, in later events.
- **`add-edge` before its nodes exist.** Both endpoints must already be in the
  graph. Add the nodes first (or include them in the original `load-graph`).
- **Duplicate ids.** `add-node`/`add-edge` are ignored if the id already exists.
- **Custom edge id.** If you don't set `attributes.id` on an edge, its id is
  `"<from>-><to>"` — use that exact string for `update`/`delete-edge`.
- **No ack received.** Use `sio.call(...)` (or an emit callback) to get acks; a
  plain `emit` without a callback won't surface validation errors.
- **Browser client blocked.** That's CORS — serve from an allowed origin or set
  `CORS_ORIGINS` on the backend.

---

## Quick reference

| Event | Payload | Ack |
|-------|---------|-----|
| `load-graph` | GLIMPSE `{ objects: [...] }` **or** NetworkX node-link dict | `{ status, objectCount }` |
| `update` | `{ id, elementType: "node"\|"edge", updates: { color, size, hidden } }` | `{ status }` |
| `add-node` | `{ objectType, elementType: "node", attributes: { id\|name, x?, y?, ... } }` | `{ status }` |
| `add-edge` | `{ objectType, elementType: "edge", attributes: { id?, from, to, ... } }` | `{ status }` |
| `delete-node` | node id (string) | `{ status }` |
| `delete-edge` | edge id (string) | `{ status }` |

All acks return `{ "error": "<message>" }` instead on failure. In `update`, any of
`color` / `size` / `hidden` may be `null` to leave that property unchanged.
