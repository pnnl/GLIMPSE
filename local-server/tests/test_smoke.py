"""End-to-end smoke test over the HTTP routes and socket events, using the
bundled sample models. Needs no GridAPPS-D broker."""
import io
import json
import zipfile
from pathlib import Path

import server

MODELS = Path(__file__).resolve().parents[2] / "models"


def upload(client, route, name, content):
    return client.post(route, data={"files": [(io.BytesIO(content), name)]})


def test_json_upload_converts_node_link():
    node_link = {
        "directed": False, "multigraph": True, "graph": {},
        "nodes": [{"id": 1, "type": "a"}, {"id": 2}],
        "edges": [{"source": 1, "target": 2, "key": 0}],
    }
    client = server.app.test_client()
    body = upload(client, "/api/upload/json", "g.json", json.dumps(node_link).encode()).get_json()
    objects = body["data"]["g.json"]["objects"]
    assert [o["elementType"] for o in objects] == ["node", "node", "edge"]
    assert objects[2]["attributes"] == {"id": "1-2-0", "from": "1", "to": "2"}

    bad = upload(client, "/api/upload/json", "g.json", b'{"objects": 5}')
    assert bad.status_code == 400 and "JSON validation error for g.json" in bad.get_json()["error"]


def test_glm_round_trip():
    client = server.app.test_client()
    parsed = upload(client, "/api/upload/glm", "IEEE-13.glm", (MODELS / "13/IEEE-13.glm").read_bytes())
    data = parsed.get_json()["data"]
    assert data["IEEE-13.json"]["objects"]

    exported = client.post("/api/export/glm", json={"data": data})
    assert exported.status_code == 200
    assert zipfile.ZipFile(io.BytesIO(exported.data)).namelist() == ["IEEE-13.glm"]


def test_cim_upload_objects_and_agents():
    client = server.app.test_client()
    resp = upload(client, "/api/upload/cim", "IEEE13.xml", (MODELS / "CIM/IEEE13.xml").read_bytes())
    objects = resp.get_json()["data"]["IEEE13.xml"]["objects"]
    assert {o["elementType"] for o in objects} == {"node", "edge"}

    mrid = objects[0]["attributes"]["id"]
    found = client.post("/api/cim/objects", json={"feeder_id": "IEEE13.xml", "mRID": mrid})
    assert found.status_code == 200
    missing = client.post("/api/cim/objects", json={"feeder_id": "IEEE13.xml", "mRID": "nope"})
    assert missing.status_code == 404

    agents = client.get("/api/gridappsd/agents?model=IEEE13.xml").get_json()
    assert agents["agents"][0]["agent_type"] == "coordinating"


def test_socket_events_validate_and_broadcast():
    client = server.socketio.test_client(server.app)
    ack = client.emit("update", {"id": "a", "elementType": "node", "updates": {"color": "red"}}, callback=True)
    assert ack == {"status": "ok"}
    assert client.get_received()[0]["args"][0]["updates"] == {"color": "red", "size": None, "hidden": None}

    assert "error" in client.emit("load-graph", [1], callback=True)
    assert "error" in client.emit("stop-simulation", "sim", callback=True)
