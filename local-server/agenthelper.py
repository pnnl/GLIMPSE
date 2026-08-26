import json
import logging
import os

logger = logging.getLogger(__name__)

LEVELS = ("feeder", "switch", "secondary")
SYSTEM_BUS_ID = "system"
DEVICE_LABELS = {
    "switch": "Switch",
    "capacitor": "Capacitor",
    "diesel_dg": "DER",
    "inverter_dyn": "DER",
    "battery": "DER",
    "load": "Load",
}

CLASS_TYPE_LABELS = {"regulator": "LTC"}
SECONDARY_LABELS = {"DER": "LV Asset", "Load": "LV Asset"}
MV_LABELS = {"DER": "MV DER", "Load": None}
MAX_DEVICES_PER_AGENT = 12
DEVICE_PRIORITY = ["LTC", "Switch", "Capacitor", "MV DER", "LV Asset"]

def invert_area_map(area_map: dict) -> dict:
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


def build_agent_model(area_map: dict, object_index: dict, model_id: str, source: str = "derived", gridappsd_helper=None) -> dict:
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
