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
# class_type is the CIM class the object was parsed from, except for regulators:
# cimhelper stamps those transformer edges "regulator", so the CIM class they are
# recognised by is restored here.
CIM_TYPE_OVERRIDES = {"regulator": "RatioTapChanger"}
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


def build_agent_model(area_map: dict, object_index: dict, model_id: str) -> dict:
    """The agent roster a loaded model implies: one agent per distribution area."""
    area_index = invert_area_map(area_map)
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
        for area_id, area in area_index[level].items():
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
        # An override mapping to None means "not shown at this level".
        label = overrides.get(label, label)
        if not label:
            continue

        class_type = entry.get("class_type") or ""
        devices.append(
            {
                "mrid": mrid,
                "name": entry.get("name") or _uuid_tail(mrid),
                "type": label,
                "cim_type": CIM_TYPE_OVERRIDES.get(class_type, class_type),
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
