"""The hosted deployment's contract: every response is self-contained.

These tests are the guard on the property that lets GLIMPSE run as N replicas
behind a plain round-robin load balancer with no sticky sessions. If someone
reintroduces server-retained state for the hosted surface, the cross-replica
test below is what catches it — a single-instance smoke test would not.
"""

import pytest

from conftest import cim_model, load_server, upload_cim


# --------------------------------------------------------------------------
# Surface
# --------------------------------------------------------------------------
HOSTED_ROUTES = {
    "/",
    "/api/examples",
    "/api/examples/load",
    "/api/export/glm",
    "/api/upload/cim",
    "/api/upload/glm",
    "/api/upload/json",
}

# Endpoints that need a resident parsed model or a GridAPPS-D broker. They must
# not exist in hosted mode — a 404 is the point, not an accident.
DESKTOP_ONLY_ROUTES = {
    "/api/cim/objects",
    "/api/cim/objects/mermaid",
    "/api/cim/measurements",
    "/api/gridappsd/models",
    "/api/gridappsd/agents",
    "/api/gridappsd/status",
    "/api/export/export-cim-coordinates",
}


def test_hosted_registers_only_the_upload_surface(hosted_server):
    rules = {str(r) for r in hosted_server.app.url_map.iter_rules()}
    assert HOSTED_ROUTES <= rules
    assert DESKTOP_ONLY_ROUTES.isdisjoint(rules)


def test_hosted_has_no_socketio(hosted_server):
    assert hosted_server.HOSTED_MODE is True
    assert hosted_server.socketio is None


def test_health_advertises_mode_and_features(hosted_client):
    body = hosted_client.get("/").get_json()
    assert body["mode"] == "hosted"
    assert body["features"] == {
        "mermaid": False,
        "gridappsd": False,
        "simulation": False,
        # False here because this fixture configures no shared job store.
        "asyncUploads": False,
    }


def test_desktop_keeps_the_full_surface():
    module = load_server("desktop")
    rules = {str(r) for r in module.app.url_map.iter_rules()}
    assert DESKTOP_ONLY_ROUTES <= rules
    assert module.socketio is not None
    assert module.app.test_client().get("/").get_json()["features"]["mermaid"] is True


# --------------------------------------------------------------------------
# Self-contained responses
# --------------------------------------------------------------------------
def test_cim_upload_ships_details_for_every_real_object(hosted_client):
    body = upload_cim(hosted_client)

    assert set(body) >= {"data", "objectDetails", "isCIM"}
    feeder = next(iter(body["data"]))
    details = body["objectDetails"][feeder]

    # Every emitted object backed by a CIM instance must carry its detail, or
    # the UI would have nothing to show for it and no endpoint to ask.
    # "->" ids are synthetic connector edges with no CIM instance behind them.
    real_ids = {
        obj["attributes"]["id"]
        for obj in body["data"][feeder]["objects"]
        if obj.get("attributes", {}).get("id") and "->" not in str(obj["attributes"]["id"])
    }
    assert real_ids, "model produced no inspectable objects"
    assert real_ids - set(details) == set()

    sample = details[next(iter(details))]
    assert set(sample) == {"identifier", "class_name", "display_name", "attributes", "associations"}


def test_hosted_retains_nothing_after_a_parse(hosted_server):
    client = hosted_server.app.test_client()
    upload_cim(client)

    helper = hosted_server.cim_helper
    assert helper.FEEDERS == {}
    assert helper.area_maps == {}
    assert helper.object_index == {}
    assert helper.active_measurement_map == {"Discrete": {}, "Analog": {}}


def test_a_second_upload_cannot_disturb_the_first_result(hosted_client):
    """Two users, one worker. The earlier response must stay complete."""
    first = upload_cim(hosted_client, "IEEE123.xml")
    first_feeder = next(iter(first["data"]))
    first_details = dict(first["objectDetails"][first_feeder])

    upload_cim(hosted_client, "IEEE13.xml")

    # The first response is a value, not a view onto server state.
    assert first["objectDetails"][first_feeder] == first_details


def test_inspection_works_across_replicas(hosted_client):
    """The cross-replica guarantee, stated as a test.

    Upload lands on one worker; the user then inspects an object. With a
    round-robin balancer and no stickiness that inspection would hit a *different*
    worker — one that never saw the upload. It has to succeed anyway, which it
    does only because the answer travelled with the upload response.
    """
    replica_a = hosted_client
    replica_b = load_server("hosted").app.test_client()

    body = upload_cim(replica_a)
    feeder = next(iter(body["data"]))
    mrid, detail = next(iter(body["objectDetails"][feeder].items()))

    # Replica B never parsed this model and offers no inspection endpoint at all.
    assert replica_b.post(
        "/api/cim/objects", json={"feeder_id": feeder, "mRID": mrid}
    ).status_code == 404

    # ...and none is needed: the client already holds the answer.
    assert detail["identifier"]
    assert detail["class_name"]


# --------------------------------------------------------------------------
# Equivalence with the endpoint the details replace
# --------------------------------------------------------------------------
def test_details_match_cimgraphs_own_object_lookup():
    """Details resolved through our index must match cimgraph's own resolution.

    Deliberately compares against FeederModel.get_object() — the slow upstream
    API — rather than against get_cim_object(), which now shares the same index
    and would therefore be comparing the index to itself.
    """
    module = load_server("desktop")
    helper = module.cim_helper

    from conftest import cim_model

    _, details = helper.cim_to_gjs(filepaths=[str(cim_model())])
    feeder_details = details["IEEE123.xml"]
    assert feeder_details

    feeder = helper.FEEDERS["IEEE123.xml"]
    # A small sample: each get_object() call scans the whole source document.
    for mrid in list(feeder_details)[:25]:
        upstream = feeder.get_object(mrid)
        assert upstream is not None, mrid
        assert helper._object_to_detail(upstream) == feeder_details[mrid], mrid


def test_object_lookup_does_not_rescan_the_source_document():
    """The index must actually replace get_object(), not sit alongside it.

    Guards the regression this fix addressed: resolving ids through
    FeederModel.get_object() is O(document) per call, which made a 6s parse take
    650s and would make every object click on a large model crawl.
    """
    module = load_server("desktop")
    helper = module.cim_helper

    from conftest import cim_model

    _, details = helper.cim_to_gjs(filepaths=[str(cim_model())])
    feeder = helper.FEEDERS["IEEE123.xml"]

    calls = []
    original = type(feeder).get_object
    type(feeder).get_object = lambda self, mrid: calls.append(mrid) or original(self, mrid)
    try:
        for mrid in list(details["IEEE123.xml"])[:50]:
            assert "error" not in helper.get_cim_object("IEEE123.xml", mrid)
    finally:
        type(feeder).get_object = original

    assert calls == [], f"get_object() was called {len(calls)} times; the index should have served these"


def test_deleting_an_object_invalidates_the_cached_index():
    """A stale index would keep resolving an object that no longer exists."""
    module = load_server("desktop")
    helper = module.cim_helper

    from conftest import cim_model

    _, details = helper.cim_to_gjs(filepaths=[str(cim_model())])
    mrid = next(iter(details["IEEE123.xml"]))

    assert helper.resolve_object("IEEE123.xml", mrid) is not None
    assert helper.delete_cim_object("IEEE123.xml", mrid) is True
    assert helper.resolve_object("IEEE123.xml", mrid) is None


# --------------------------------------------------------------------------
# The stateless endpoints stay stateless
# --------------------------------------------------------------------------
@pytest.mark.parametrize("endpoint", ["/api/upload/json", "/api/upload/glm"])
def test_uploads_reject_empty_requests(hosted_client, endpoint):
    response = hosted_client.post(endpoint, data={}, content_type="multipart/form-data")
    assert response.status_code == 400


# --------------------------------------------------------------------------
# Measurements
# --------------------------------------------------------------------------
_PARSE_CACHE: dict = {}


def _parse_in_mode(mode: str):
    """Parse a CIM model with cimhelper loaded in the given GLIMPSE_MODE.

    Cached per mode: re-importing cimhelper pulls the whole cimgraph stack back
    in, which costs more than the parse it is set up for.
    """
    import importlib
    import os
    import sys

    if mode in _PARSE_CACHE:
        return _PARSE_CACHE[mode]

    previous = os.environ.get("GLIMPSE_MODE")
    os.environ["GLIMPSE_MODE"] = mode
    sys.modules.pop("cimhelper", None)
    try:
        cimhelper = importlib.import_module("cimhelper")
        helper = cimhelper.CIMHelper()
        data, details = helper.cim_to_gjs(filepaths=[str(cim_model())])
        feeder = next(iter(data))
        _PARSE_CACHE[mode] = {
            "objects": data[feeder]["objects"],
            "details": details[feeder],
            "measurement_entries": sum(len(v) for v in helper.active_measurement_map.values()),
            "switch_mrids": sum(
                len(o["attributes"].get("measurement_mrids", []))
                for o in data[feeder]["objects"]
                if o.get("objectType") == "switch"
            ),
        }
        return _PARSE_CACHE[mode]
    finally:
        if previous is None:
            os.environ.pop("GLIMPSE_MODE", None)
        else:
            os.environ["GLIMPSE_MODE"] = previous
        sys.modules.pop("cimhelper", None)


def test_hosted_does_not_parse_measurements_at_all():
    """Every measurement consumer is a desktop-only simulation feature.

    Parsing them in hosted mode is work nothing can reach: IEEE 9500 carries
    24,003 of them, a quarter of the file.
    """
    hosted = _parse_in_mode("hosted")

    assert hosted["measurement_entries"] == 0
    assert hosted["switch_mrids"] == 0


def test_skipping_measurements_costs_the_visualization_nothing():
    """The saving has to be free — the graph must be identical either way.

    Measurements were never rendered, so dropping them may not change the object
    graph or the inspectable details by a single entry.
    """
    desktop = _parse_in_mode("desktop")
    hosted = _parse_in_mode("hosted")

    assert len(hosted["objects"]) == len(desktop["objects"])
    assert len(hosted["details"]) == len(desktop["details"])
    assert {o["attributes"]["id"] for o in hosted["objects"]} == {
        o["attributes"]["id"] for o in desktop["objects"]
    }


def test_desktop_still_parses_measurements():
    """The gate is mode-specific, not a blanket removal: simulation needs these."""
    desktop = _parse_in_mode("desktop")

    assert desktop["measurement_entries"] > 0
    assert desktop["switch_mrids"] > 0
