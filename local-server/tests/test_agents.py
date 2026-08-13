"""Unit tests for the distributed-agent roster (agenthelper)."""

import json

import pytest

import agenthelper


# A three-level model: one feeder area, two switch areas under it, and one
# secondary area under the first switch area. Every record carries its full
# ancestry, which is what the real _build_*_area_map functions produce.
FEEDER = "feeder-area-aaaa"
SWITCH_A = "switch-area-bbbb"
SWITCH_B = "switch-area-cccc"
SECONDARY = "secondary-area-dddd"


def _record(feeder=None, switch=None, secondary=None):
    record = {}
    if feeder:
        record["feeder_area_id"] = feeder
        record["feeder_area_name"] = "Feeder 1"
    if switch:
        record["switch_area_id"] = switch
        record["switch_area_name"] = f"Switch {switch[-4:]}"
    if secondary:
        record["secondary_area_id"] = secondary
        record["secondary_area_name"] = "Secondary 1"
    return record


@pytest.fixture
def area_map():
    return {
        "reg-1": _record(feeder=FEEDER),
        "swgear-1": _record(feeder=FEEDER),
        "cap-1": _record(feeder=FEEDER, switch=SWITCH_A),
        "node-1": _record(feeder=FEEDER, switch=SWITCH_A),
        "der-1": _record(feeder=FEEDER, switch=SWITCH_B),
        "load-1": _record(feeder=FEEDER, switch=SWITCH_A, secondary=SECONDARY),
    }


@pytest.fixture
def object_index():
    return {
        "reg-1": {"name": "reg1", "objectType": "transformer", "class_type": "regulator", "phases": "ABC"},
        "swgear-1": {"name": "sw1", "objectType": "switch", "class_type": "Breaker", "phases": "ABC"},
        "cap-1": {"name": "cap1", "objectType": "capacitor", "class_type": "", "phases": "A"},
        "node-1": {"name": "n1", "objectType": "connectivity_node", "class_type": "", "phases": ""},
        "der-1": {"name": "der1", "objectType": "inverter_dyn", "class_type": "", "phases": "ABC"},
        "load-1": {"name": "load1", "objectType": "load", "class_type": "", "phases": "A"},
    }


# ── invert_area_map ─────────────────────────────────────────────────────────


def test_invert_area_map_builds_the_hierarchy(area_map):
    index = agenthelper.invert_area_map(area_map)

    assert set(index["feeder"]) == {FEEDER}
    assert set(index["switch"]) == {SWITCH_A, SWITCH_B}
    assert set(index["secondary"]) == {SECONDARY}

    assert index["feeder"][FEEDER]["parent_id"] is None
    assert index["switch"][SWITCH_A]["parent_id"] == FEEDER
    assert index["secondary"][SECONDARY]["parent_id"] == SWITCH_A


def test_members_land_at_their_deepest_area(area_map):
    """A load inside a secondary area belongs to it, not to its switch area."""
    index = agenthelper.invert_area_map(area_map)

    assert index["secondary"][SECONDARY]["members"] == ["load-1"]
    assert "load-1" not in index["switch"][SWITCH_A]["members"]
    assert sorted(index["switch"][SWITCH_A]["members"]) == ["cap-1", "node-1"]
    assert sorted(index["feeder"][FEEDER]["members"]) == ["reg-1", "swgear-1"]


def test_invert_area_map_tolerates_empty_and_missing_records():
    assert agenthelper.invert_area_map({}) == {"feeder": {}, "switch": {}, "secondary": {}}
    assert agenthelper.invert_area_map(None)["feeder"] == {}
    # An object with no area at all is normal and must not create an area.
    assert agenthelper.invert_area_map({"orphan": {}})["feeder"] == {}


def test_area_name_falls_back_to_the_uuid_tail():
    index = agenthelper.invert_area_map({"m": {"feeder_area_id": "abc-1234", "feeder_area_name": ""}})
    assert index["feeder"]["abc-1234"]["name"] == "1234"


# ── derive_agents ───────────────────────────────────────────────────────────


def test_derive_agents_makes_one_agent_per_area_plus_a_coordinator(area_map, object_index):
    model = agenthelper.derive_agents(
        agenthelper.invert_area_map(area_map), object_index, "model-1"
    )

    assert model["source"] == "derived"
    assert model["model"] == "model-1"

    by_level = {}
    for agent in model["agents"]:
        by_level.setdefault(agent["level"], []).append(agent)

    assert len(by_level["system"]) == 1
    assert by_level["system"][0]["agent_type"] == "coordinating"
    assert len(by_level["feeder"]) == 1
    assert len(by_level["switch"]) == 2
    assert len(by_level["secondary"]) == 1
    assert all(a["agent_type"] == "distributed" for a in model["agents"][1:])


def test_agents_are_addressed_by_their_area_mrid(area_map, object_index):
    """The join with the graph depends on message_bus_id being the area mRID."""
    model = agenthelper.derive_agents(
        agenthelper.invert_area_map(area_map), object_index, "model-1"
    )

    for agent in model["agents"]:
        if agent["level"] == "system":
            assert agent["area_id"] is None
            assert agent["message_bus_id"] == agenthelper.SYSTEM_BUS_ID
        else:
            assert agent["message_bus_id"] == agent["area_id"]

    assert {a["area_id"] for a in model["agents"]} == {
        None, FEEDER, SWITCH_A, SWITCH_B, SECONDARY,
    }


def test_status_is_unknown_not_faked(area_map, object_index):
    model = agenthelper.derive_agents(
        agenthelper.invert_area_map(area_map), object_index, "model-1"
    )
    assert {a["status"] for a in model["agents"]} == {"unknown"}


def test_buses_form_a_connected_tree(area_map, object_index):
    model = agenthelper.derive_agents(
        agenthelper.invert_area_map(area_map), object_index, "model-1"
    )
    bus_ids = {bus["bus_id"] for bus in model["buses"]}

    for bus in model["buses"]:
        if bus["parent_bus_id"] is not None:
            assert bus["parent_bus_id"] in bus_ids

    # Every agent sits on a bus that exists.
    assert {a["message_bus_id"] for a in model["agents"]} <= bus_ids


def test_devices_are_classified_and_labelled_by_level(area_map, object_index):
    model = agenthelper.derive_agents(
        agenthelper.invert_area_map(area_map), object_index, "model-1"
    )
    devices = {a["area_id"]: {d["name"]: d["type"] for d in a["devices"]} for a in model["agents"]}

    # A regulator is a "transformer" objectType; only class_type identifies it.
    assert devices[FEEDER] == {"reg1": "LTC", "sw1": "Switch"}
    # Connectivity nodes are not commandable equipment and get no chip.
    assert devices[SWITCH_A] == {"cap1": "Capacitor"}
    # The same DER reads as MV on a switch bus and LV on a secondary bus.
    assert devices[SWITCH_B] == {"der1": "MV DER"}
    assert devices[SECONDARY] == {"load1": "LV Asset"}


def test_plain_loads_are_dropped_above_the_secondary_level():
    """
    A feeder carries hundreds of loads and an MV agent doesn't act on them, so
    keeping them would bury the equipment it does act on.
    """
    areas = {"load-1": _record(feeder=FEEDER), "cap-1": _record(feeder=FEEDER)}
    index = {
        "load-1": {"name": "l1", "objectType": "load", "class_type": "", "phases": ""},
        "cap-1": {"name": "c1", "objectType": "capacitor", "class_type": "", "phases": ""},
    }

    model = agenthelper.derive_agents(agenthelper.invert_area_map(areas), index, "model-1")
    feeder_agent = next(a for a in model["agents"] if a["area_id"] == FEEDER)

    assert [d["name"] for d in feeder_agent["devices"]] == ["c1"]


def test_device_list_is_capped():
    many = {f"load-{i}": _record(feeder=FEEDER, switch=SWITCH_A, secondary=SECONDARY)
            for i in range(50)}
    index = {f"load-{i}": {"name": f"l{i}", "objectType": "load", "class_type": "", "phases": ""}
             for i in range(50)}

    model = agenthelper.derive_agents(agenthelper.invert_area_map(many), index, "model-1")
    agent = next(a for a in model["agents"] if a["area_id"] == SECONDARY)

    assert len(agent["devices"]) == agenthelper.MAX_DEVICES_PER_AGENT
    assert {d["type"] for d in agent["devices"]} == {"LV Asset"}


def test_the_cap_keeps_the_devices_that_matter():
    """
    A crowded secondary area should lose an interchangeable asset, not its one
    tap changer.
    """
    areas = {f"load-{i}": _record(feeder=FEEDER, switch=SWITCH_A, secondary=SECONDARY)
             for i in range(50)}
    areas["reg-1"] = _record(feeder=FEEDER, switch=SWITCH_A, secondary=SECONDARY)

    index = {f"load-{i}": {"name": f"l{i}", "objectType": "load", "class_type": "", "phases": ""}
             for i in range(50)}
    # Last in iteration order, so only ranking can save it from the cap.
    index["reg-1"] = {"name": "reg1", "objectType": "transformer",
                      "class_type": "regulator", "phases": "ABC"}

    model = agenthelper.derive_agents(agenthelper.invert_area_map(areas), index, "model-1")
    agent = next(a for a in model["agents"] if a["area_id"] == SECONDARY)

    assert len(agent["devices"]) == agenthelper.MAX_DEVICES_PER_AGENT
    assert agent["devices"][0]["type"] == "LTC"


def test_derive_agents_on_a_model_with_no_areas():
    """A model without CIM area objects still yields the coordinating agent."""
    model = agenthelper.derive_agents(agenthelper.invert_area_map({}), {}, "model-1")

    assert len(model["agents"]) == 1
    assert model["agents"][0]["level"] == "system"
    assert len(model["buses"]) == 1


# ── normalize_agents ────────────────────────────────────────────────────────


def test_normalize_fills_area_names_from_the_model(area_map):
    index = agenthelper.invert_area_map(area_map)
    raw = {"agents": [{"agent_id": "a1", "message_bus_id": SWITCH_A, "status": "online"}]}

    model = agenthelper.normalize_agents(raw, index, "model-1")
    agent = model["agents"][0]

    assert agent["area_id"] == SWITCH_A
    assert agent["area_name"] == "Switch bbbb"
    assert agent["level"] == "switch"
    assert agent["agent_type"] == "distributed"
    assert agent["status"] == "online"


def test_normalize_keeps_agents_for_areas_not_in_the_model(area_map):
    """An agent GLIMPSE can't place on the graph still belongs in the panel."""
    index = agenthelper.invert_area_map(area_map)
    raw = {"agents": [{"agent_id": "ghost", "message_bus_id": "area-not-loaded"}]}

    model = agenthelper.normalize_agents(raw, index, "model-1")

    assert len(model["agents"]) == 1
    assert model["agents"][0]["area_id"] == "area-not-loaded"
    assert model["agents"][0]["area_name"] == "loaded"  # uuid tail fallback


def test_normalize_guarantees_the_schema(area_map):
    index = agenthelper.invert_area_map(area_map)
    raw = {"agents": [{}, "not-a-dict", {"agent_id": "a2", "devices": "nonsense"}]}

    model = agenthelper.normalize_agents(raw, index, "model-1")

    assert len(model["agents"]) == 2  # the string is dropped
    for agent in model["agents"]:
        assert set(agent) == {
            "agent_id", "agent_type", "level", "message_bus_id",
            "area_id", "area_name", "status", "devices",
        }
        assert agent["devices"] == []
        assert agent["status"] == "unknown"


def test_normalize_treats_the_system_bus_as_arealess(area_map):
    index = agenthelper.invert_area_map(area_map)
    raw = {"agents": [{"agent_id": "coord", "message_bus_id": agenthelper.SYSTEM_BUS_ID}]}

    agent = agenthelper.normalize_agents(raw, index, "model-1")["agents"][0]

    assert agent["area_id"] is None
    assert agent["level"] == "system"
    assert agent["agent_type"] == "coordinating"


def test_normalize_handles_an_empty_payload(area_map):
    index = agenthelper.invert_area_map(area_map)

    for raw in (None, {}, {"agents": []}, {"agents": None}):
        model = agenthelper.normalize_agents(raw, index, "model-1")
        assert model["agents"] == []
        # The system bus always exists, so the diagram has something to draw.
        assert [bus["bus_id"] for bus in model["buses"]] == [agenthelper.SYSTEM_BUS_ID]


# ── build_agent_model (source selection) ────────────────────────────────────


def test_build_defaults_to_derived(area_map, object_index):
    model = agenthelper.build_agent_model(area_map, object_index, "model-1")
    assert model["source"] == "derived"
    assert len(model["agents"]) == 5


def test_build_reads_a_fixture(tmp_path, monkeypatch, area_map, object_index):
    fixture = tmp_path / "agents.json"
    fixture.write_text(json.dumps({
        "source": "fixture",
        "agents": [{"agent_id": "from-fixture", "message_bus_id": SWITCH_A}],
    }))
    monkeypatch.setenv("GLIMPSE_AGENTS_FIXTURE", str(fixture))

    model = agenthelper.build_agent_model(area_map, object_index, "model-1", source="fixture")

    assert model["source"] == "fixture"
    assert [a["agent_id"] for a in model["agents"]] == ["from-fixture"]


def test_build_falls_back_to_derived_when_a_source_yields_nothing(
    monkeypatch, area_map, object_index
):
    """A missing fixture or an absent broker degrades to a usable roster."""
    monkeypatch.delenv("GLIMPSE_AGENTS_FIXTURE", raising=False)

    for source in ("fixture", "gridappsd"):
        model = agenthelper.build_agent_model(
            area_map, object_index, "model-1", source=source, gridappsd_helper=None
        )
        assert model["source"] == "derived"
        assert len(model["agents"]) == 5
