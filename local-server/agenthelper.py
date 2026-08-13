"""
Distributed-agent roster, grouped by distribution area.

GridAPPS-D runs a layered set of agents: one Coordinating Agent on the
distribution-system message bus, one Distributed Agent on the feeder bus, one per
switch area, and one per secondary area. Each agent is addressed by its
`message_bus_id`, which is the mRID of the CIM FeederArea / SwitchArea /
SecondaryArea it operates -- the same ids GLIMPSE already stamps onto every node
and edge as feeder_area_id / switch_area_id / secondary_area_id. So an agent maps
onto the visualization by a direct id match, with no translation layer.

The platform topic that publishes the live agent roster isn't wired up yet, so
this module supports three interchangeable sources, all funnelled through
`normalize_agents`:

  derived   -- synthesize one agent per area from the distribution-area map the
               CIM load already produced. Needs no broker and works on any model
               that has area objects, which is what makes the UI testable today.
  fixture   -- read a captured payload from disk (GLIMPSE_AGENTS_FIXTURE), for
               developing against a real response before the topic is live.
  gridappsd -- request the roster from the platform. Stubbed until the topic and
               response shape are known; see `agents_from_gridappsd`.

Everything here is pure except the two source functions, so the shape of the
result can be tested without a broker or a Blazegraph.
"""

import json
import logging
import os

logger = logging.getLogger(__name__)

# Area levels, general -> specific. The ancestry records produced by CIMHelper
# use "<level>_area_id" / "<level>_area_name"; the agent model and the bus
# diagram use the short level name.
LEVELS = ("feeder", "switch", "secondary")

# The distribution-system bus sits above every model-derived area, so it has no
# mRID of its own. This constant is its bus id in the normalized model.
SYSTEM_BUS_ID = "system"

# objectType (as emitted by CIMHelper) -> the device label used on the bus
# diagram. Anything unlisted is not drawn as a device chip; a feeder has
# thousands of line segments and connectivity nodes, and none of them are things
# an agent commands.
DEVICE_LABELS = {
    "switch": "Switch",
    "capacitor": "Capacitor",
    "diesel_dg": "DER",
    "inverter_dyn": "DER",
    "battery": "DER",
    "load": "Load",
}

# CIMHelper emits every regulator as objectType "transformer" and marks it with
# class_type "regulator", so the tap changer -- the one transformer an agent
# actually commands -- is only distinguishable by class_type.
CLASS_TYPE_LABELS = {"regulator": "LTC"}

# The same equipment reads differently depending on which bus it hangs off:
# medium-voltage resources sit on a feeder or switch-area bus, while everything
# on a secondary bus is a low-voltage asset. Applied after DEVICE_LABELS; a label
# mapped to None is not drawn at that level.
#
# Plain loads are dropped above the secondary level on purpose. A feeder carries
# hundreds of them and they are not what an agent on an MV bus acts on, so
# keeping them there buries the capacitors, switches and tap changers that are.
SECONDARY_LABELS = {"DER": "LV Asset", "Load": "LV Asset"}
MV_LABELS = {"DER": "MV DER", "Load": None}

# Cap on device chips carried per agent. A secondary area can contain hundreds of
# loads; past a handful the bus diagram is unreadable and the payload is wasted.
MAX_DEVICES_PER_AGENT = 12

# Which devices survive the cap. Ordered by how much an operator cares that an
# agent controls one, so truncating a crowded area drops the interchangeable
# assets rather than the single tap changer.
DEVICE_PRIORITY = ["LTC", "Switch", "Capacitor", "MV DER", "LV Asset"]


def invert_area_map(area_map: dict) -> dict:
    """
    Turn the member-keyed ancestry map that CIMHelper builds into an area-keyed
    hierarchy.

    Input (from _build_distribution_area_map / _build_topology_area_map):

        { "<member mRID>": { "feeder_area_id", "feeder_area_name",
                             "switch_area_id", ..., "secondary_area_id", ... } }

    Output:

        { "feeder":    { "<area mRID>": {"name", "parent_id", "members": [...]} },
          "switch":    { ... },
          "secondary": { ... } }

    Every record carries its *full* ancestry, so parent links fall straight out
    of the record being read -- no second pass, no lookups. Members are
    accumulated at the most specific level each record names, which is what makes
    a switch area's member list exclude the members that really belong to one of
    its secondary areas.
    """
    index = {level: {} for level in LEVELS}

    for member_mrid, record in (area_map or {}).items():
        if not record:
            continue

        parent_id = None
        deepest = None

        for level in LEVELS:
            area_id = record.get(f"{level}_area_id")
            if not area_id:
                # Ancestry is contiguous from the top; a gap ends the chain.
                break

            area = index[level].setdefault(
                area_id,
                {
                    "name": record.get(f"{level}_area_name") or _uuid_tail(area_id),
                    "parent_id": parent_id,
                    "members": [],
                },
            )
            parent_id = area_id
            deepest = area

        if deepest is not None:
            deepest["members"].append(member_mrid)

    return index


def derive_agents(area_index: dict, object_index: dict, model_id: str) -> dict:
    """
    Synthesize the agent roster implied by a model's distribution areas: one
    coordinating agent on the system bus, and one distributed agent per area.

    This is what the platform *would* spawn for this model, so it renders the
    real hierarchy with real area ids -- clicking a derived agent highlights the
    correct part of the grid. Only the agent identities and their status are
    invented, and status is reported as "unknown" rather than faked.
    """
    buses = [
        {
            "bus_id": SYSTEM_BUS_ID,
            "level": "system",
            "name": "Distribution System",
            "area_id": None,
            "parent_bus_id": None,
        }
    ]
    agents = [
        {
            "agent_id": f"coordinating-{_uuid_tail(model_id)}",
            "agent_type": "coordinating",
            "level": "system",
            "message_bus_id": SYSTEM_BUS_ID,
            "area_id": None,
            "area_name": "Distribution System",
            "status": "unknown",
            "devices": [],
        }
    ]

    for level in LEVELS:
        for area_id, area in (area_index.get(level) or {}).items():
            buses.append(
                {
                    "bus_id": area_id,
                    "level": level,
                    "name": area["name"],
                    "area_id": area_id,
                    "parent_bus_id": area["parent_id"] or SYSTEM_BUS_ID,
                }
            )
            agents.append(
                {
                    "agent_id": f"{level}-agent-{_uuid_tail(area_id)}",
                    "agent_type": "distributed",
                    "level": level,
                    "message_bus_id": area_id,
                    "area_id": area_id,
                    "area_name": area["name"],
                    "status": "unknown",
                    "devices": _area_devices(area["members"], object_index, level),
                }
            )

    return {"model": model_id, "source": "derived", "buses": buses, "agents": agents}


def agents_from_fixture(path: str) -> dict:
    """Raw agent payload captured from the platform and saved to disk."""
    with open(path, "r", encoding="utf-8") as fixture:
        return json.load(fixture)


def agents_from_gridappsd(gridappsd_helper, model_id: str) -> dict | None:
    """
    Request the live agent roster from the GridAPPS-D platform.

    STUB. The topic that publishes which agents are running in which area is not
    known yet, so this always reports "unavailable" and the caller falls back to
    the derived roster. When the topic is known, the only work is issuing the
    request here and teaching `normalize_agents` to read its response -- nothing
    downstream of this module changes.

    Deliberately mirrors GridAPPSDHelper.get_distributed_areas: connection
    pre-check, a bounded timeout, and a session-level circuit breaker so a
    missing service can't slow every subsequent request.
    """
    if gridappsd_helper is None or not gridappsd_helper.is_available():
        return None

    # TODO: replace with the real topic and request once the platform exposes it.
    #   topic = "goss.gridappsd.request.data.<agents>"
    #   message = {"requestType": "GET_AGENTS", "modelId": model_id}
    #   return gridappsd_helper.get_agent_roster(topic, message)
    logger.info(
        "Live agent roster requested for %s, but the GridAPPS-D agent topic is "
        "not implemented yet; falling back to the derived roster.",
        model_id,
    )
    return None


def normalize_agents(raw: dict | None, area_index: dict, model_id: str) -> dict:
    """
    The single swap point between an upstream agent payload and what GLIMPSE
    renders.

    Guarantees the documented schema: every agent has an agent_id, agent_type,
    level, message_bus_id, area_id, area_name, status and devices list, and every
    bus an agent references exists in `buses`. Area names are resolved from
    `area_index`, since an upstream payload identifies areas by mRID only.

    A payload that names an area the loaded model doesn't contain is kept, not
    dropped -- an agent GLIMPSE can't place on the graph still belongs in the
    panel and the bus diagram.
    """
    raw_agents = (raw or {}).get("agents") or []
    area_by_id = {
        area_id: (level, area)
        for level in LEVELS
        for area_id, area in (area_index.get(level) or {}).items()
    }

    agents = []
    for entry in raw_agents:
        if not isinstance(entry, dict):
            continue

        area_id = entry.get("area_id") or entry.get("message_bus_id")
        if area_id == SYSTEM_BUS_ID:
            area_id = None

        level, area = area_by_id.get(area_id, (None, None))
        level = entry.get("level") or level or ("system" if area_id is None else "switch")

        agents.append(
            {
                "agent_id": str(entry.get("agent_id") or entry.get("name") or ""),
                "agent_type": entry.get("agent_type")
                or ("coordinating" if level == "system" else "distributed"),
                "level": level,
                "message_bus_id": entry.get("message_bus_id") or area_id or SYSTEM_BUS_ID,
                "area_id": area_id,
                "area_name": entry.get("area_name")
                or (area["name"] if area else None)
                or ("Distribution System" if area_id is None else _uuid_tail(area_id)),
                "status": entry.get("status") or "unknown",
                "devices": _normalize_devices(entry.get("devices")),
            }
        )

    return {
        "model": (raw or {}).get("model") or model_id,
        "source": (raw or {}).get("source") or "gridappsd",
        "buses": _buses_for(agents, area_index),
        "agents": agents,
    }


# ── internals ───────────────────────────────────────────────────────────────


def _uuid_tail(mrid) -> str:
    return str(mrid).split("-")[-1]


def _area_devices(members: list, object_index: dict, level: str) -> list:
    """The commandable equipment in one area, as device chips for the bus row."""
    overrides = SECONDARY_LABELS if level == "secondary" else MV_LABELS
    devices = []

    for mrid in members:
        entry = (object_index or {}).get(mrid)
        if not entry:
            continue

        label = CLASS_TYPE_LABELS.get(entry.get("class_type")) or DEVICE_LABELS.get(
            entry.get("objectType")
        )
        if not label:
            continue

        # An override mapping to None means "not shown at this level".
        label = overrides[label] if label in overrides else label
        if not label:
            continue

        devices.append(
            {
                "mrid": mrid,
                "name": entry.get("name") or _uuid_tail(mrid),
                "type": label,
                "phases": entry.get("phases", ""),
            }
        )

    # Rank before capping, so a crowded area keeps its tap changer and loses a
    # load rather than the other way round. Stable within a rank, so the order
    # of a given type still follows the model.
    devices.sort(key=lambda d: _device_rank(d["type"]))
    return devices[:MAX_DEVICES_PER_AGENT]


def _device_rank(device_type: str) -> int:
    try:
        return DEVICE_PRIORITY.index(device_type)
    except ValueError:
        return len(DEVICE_PRIORITY)


def _normalize_devices(devices) -> list:
    if not isinstance(devices, list):
        return []

    normalized = []
    for device in devices[:MAX_DEVICES_PER_AGENT]:
        if not isinstance(device, dict):
            continue
        mrid = device.get("mrid") or device.get("@id") or ""
        normalized.append(
            {
                "mrid": str(mrid),
                "name": str(device.get("name") or _uuid_tail(mrid)),
                "type": str(device.get("type") or "Device"),
                "phases": str(device.get("phases") or ""),
            }
        )
    return normalized


def _buses_for(agents: list, area_index: dict) -> list:
    """
    Every bus the normalized agents sit on, parented through the area hierarchy.

    Built from the agents rather than from the area index so a roster that only
    covers part of a model doesn't draw empty bus bars for the rest of it.
    """
    parent_by_area = {
        area_id: area["parent_id"]
        for level in LEVELS
        for area_id, area in (area_index.get(level) or {}).items()
    }

    buses = {
        SYSTEM_BUS_ID: {
            "bus_id": SYSTEM_BUS_ID,
            "level": "system",
            "name": "Distribution System",
            "area_id": None,
            "parent_bus_id": None,
        }
    }

    for agent in agents:
        bus_id = agent["message_bus_id"]
        if bus_id in buses:
            continue
        buses[bus_id] = {
            "bus_id": bus_id,
            "level": agent["level"],
            "name": agent["area_name"],
            "area_id": agent["area_id"],
            "parent_bus_id": parent_by_area.get(agent["area_id"]) or SYSTEM_BUS_ID,
        }

    return list(buses.values())


def build_agent_model(
    area_map: dict,
    object_index: dict,
    model_id: str,
    source: str = "derived",
    gridappsd_helper=None,
) -> dict:
    """
    Resolve one of the three sources into the normalized agent model.

    `gridappsd` and `fixture` fall back to `derived` when they produce nothing,
    so a missing broker or a missing fixture file degrades to a usable roster
    instead of an empty panel -- the same graceful-degradation rule the rest of
    the GridAPPS-D integration follows.
    """
    area_index = invert_area_map(area_map)

    raw = None
    if source == "gridappsd":
        raw = agents_from_gridappsd(gridappsd_helper, model_id)
    elif source == "fixture":
        path = os.environ.get("GLIMPSE_AGENTS_FIXTURE", "")
        if path and os.path.isfile(path):
            raw = agents_from_fixture(path)
        else:
            logger.warning(
                "Agent fixture requested but GLIMPSE_AGENTS_FIXTURE is unset or "
                "does not point at a file; deriving agents from the model instead."
            )

    if raw:
        return normalize_agents(raw, area_index, model_id)

    return derive_agents(area_index, object_index, model_id)
