import os
import json
import threading
from uuid import UUID
from dataclasses import fields, is_dataclass
from SPARQLWrapper import JSON as SPARQL_JSON, POST as SPARQL_POST, SPARQLWrapper
from cimgraph.databases.blazegraph.blazegraph import BlazegraphConnection
from cimgraph.models.feeder_model import FeederModel
import cimgraph.utils as cim_utils
from cimgraph.databases.fileparsers.xml_parser import XMLFile
import cimgraph.data_profile.cimhub_2023 as cim
import cimgraph_patch

# Speeds up cimgraph's edge construction — see cimgraph_patch for what it
# replaces and why it is safe. Byte-identical output; set GLIMPSE_CIMGRAPH_PATCH=0
# to run on the library's own implementation instead.
cimgraph_patch.apply()

HOSTED_MODE = os.environ.get("GLIMPSE_MODE", "desktop").strip().lower() == "hosted"
MEASUREMENT_CLASSES = frozenset({"Analog", "Discrete"})


class MeasurementFreeXMLFile(XMLFile):
    @staticmethod
    def _class_name(element) -> str:
        return element.tag.split("}")[-1]

    def parse_nodes(self, element):
        if self._class_name(element) in MEASUREMENT_CLASSES:
            return None
        return super().parse_nodes(element)

    def parse_edges(self, element):
        if self._class_name(element) in MEASUREMENT_CLASSES:
            return None
        return super().parse_edges(element)


def _env_default(name: str, value: str) -> None:
    if not os.environ.get(name, "").strip():
        os.environ[name] = value

def _gridappsd_host() -> str:
    """Host part of GRIDAPPSD_ADDRESS — a bare hostname or a URI like
    tcp://broker:61613 — falling back to localhost."""
    address = os.environ.get("GRIDAPPSD_ADDRESS", "").strip()
    if not address:
        return "localhost"
    from urllib.parse import urlsplit

    parsed = urlsplit(address if "//" in address else f"//{address}")
    return parsed.hostname or "localhost"

_blazegraph_host = _gridappsd_host()
_env_default("CIMG_CIM_PROFILE", "cimhub_2023")
_env_default("CIMG_URL", f"http://{_blazegraph_host}:8889/bigdata/namespace/kb/sparql")
_env_default("CIMG_DATABASE", "powergridmodel")
_env_default("CIMG_HOST", _blazegraph_host)
_env_default("CIMG_PORT", "61613")
_env_default("CIMG_USERNAME", "test_app_user")
_env_default("CIMG_PASSWORD", "4Test")
_env_default("CIMG_NAMESPACE", "http://iec.ch/TC57/CIM100#")
_env_default("CIMG_IEC61970_301", "8")
_env_default("CIMG_USE_UNITS", "False")

SPARQL_QUERY_TIMEOUT = int(os.environ.get("GLIMPSE_SPARQL_TIMEOUT", "120"))
SPARQL_MAX_CONCURRENT = int(os.environ.get("GLIMPSE_SPARQL_MAX_CONCURRENT", "4"))


class SafeBlazegraphConnection(BlazegraphConnection):
    def __init__(self):
        self._query_slots = threading.BoundedSemaphore(SPARQL_MAX_CONCURRENT)
        super().__init__()

    def _run_query(self, message: str):
        wrapper = SPARQLWrapper(self.url)
        wrapper.setReturnFormat(SPARQL_JSON)
        wrapper.setMethod(SPARQL_POST)
        wrapper.setTimeout(SPARQL_QUERY_TIMEOUT)
        wrapper.setQuery(message)
        with self._query_slots:
            return wrapper.query()

    def _execute_raw_query(self, query_message: str):
        return self._run_query(query_message).convert()

    def _update_raw(self, update_message: str):
        return self._run_query(update_message)


# Current CIM network model - this holds the main graph data
class CIMHelper:
    def __init__(self) -> None:
        self.active_measurement_map: dict = {"Discrete": {}, "Analog": {}}
        self.FEEDERS: dict[str, FeederModel] = {}
        # feeder_id -> { member mRID: ancestry record } (see _build_*_area_map)
        self.area_maps: dict[str, dict] = {}
        # feeder_id -> { mRID: {"name", "objectType", "elementType"} }
        self.object_index: dict[str, dict] = {}
        # feeder_id -> { normalized id: CIM object }; see _build_mrid_index.
        self._mrid_indexes: dict[str, dict] = {}

    @staticmethod
    def count_objects(gjs: dict) -> int:
        return sum(len(feeder.get("objects", [])) for feeder in (gjs or {}).values())

    # ------------------------------------------------------------------
    # State lifecycle
    # ------------------------------------------------------------------
    def release(self) -> None:
        self.active_measurement_map = {"Discrete": {}, "Analog": {}}
        self.FEEDERS = {}
        self.area_maps = {}
        self.object_index = {}
        self._mrid_indexes = {}

    def classify_line(self, line: object) -> str:
        UNDERGROUND_INFO = (
            getattr(cim, "ConcentricNeutralCableInfo", None),
            getattr(cim, "TapeShieldCableInfo", None),
            getattr(cim, "CableInfo", None),
        )
        UNDERGROUND_INFO = tuple(c for c in UNDERGROUND_INFO if c is not None)
        # Gather WireInfo objects from every phase of this segment
        infos = []
        for phs in line.ACLineSegmentPhases or []:
            if phs.WireInfo is not None:
                infos.append(phs.WireInfo)

        # Fallback: check Assets/AssetInfo if phases aren't populated
        if not infos:
            for asset in getattr(line, "Assets", None) or []:
                if getattr(asset, "AssetInfo", None) is not None:
                    infos.append(asset.AssetInfo)

        if not infos:
            return "overhead_line"  # or "unknown" — pick a default

        if any(isinstance(i, UNDERGROUND_INFO) for i in infos):
            return "underground_line"
        if any(isinstance(i, cim.OverheadWireInfo) for i in infos):
            return "overhead_line"
        return "line"

    def _get_cim_feeder(self, model_id: str):
        database = SafeBlazegraphConnection()
        # database = GridappsdConnection()
        feeder = cim.Feeder(mRID=model_id)
        feeder_model = FeederModel(connection=database, container=feeder)
        return feeder_model

    # gjs: GLIMPSE JSON Structure
    def cim_to_gjs(
        self,
        model_IDs: list[str] | None = None,
        filepaths: list[str] | None = None,
        topology_outputs: dict[str, dict] | None = None,
        progress_cb=None,
    ):
        topology_outputs = topology_outputs or {}
        self.active_measurement_map = {"Discrete": {}, "Analog": {}}  # Reset measurement map for new model(s)
        # Reset once per load request (not per model) so a multi-model load
        # keeps every FeederModel available for object lookups and exports.
        self.FEEDERS = {}
        # Distribution-area ancestry and a light object index, kept per feeder so
        # the agents endpoint can rebuild the area hierarchy after the load
        # without re-running any SPARQL. See _parse_model.
        self.area_maps = {}
        self.object_index = {}
        self._mrid_indexes = {}
        if model_IDs is not None:
            gjs = {id: {"objects": []} for id in model_IDs}
            object_details: dict[str, dict] = {}

            for id in model_IDs:
                gjs[id]["objects"], object_details[id] = self._parse_model(
                    model_id=id,
                    topology_json=topology_outputs.get(id),
                    progress_cb=progress_cb,
                )

            return gjs, object_details

        if filepaths is not None:
            gjs = { os.path.basename(path): {"objects": []} for path in filepaths }
            object_details = {}

            for path in filepaths:
                filename = os.path.basename(path)
                gjs[filename]["objects"], object_details[filename] = self._parse_model(
                    filepath=path, topology_json=topology_outputs.get(filename)
                )

            return gjs, object_details

        return {}, {}

    def _parse_model(
        self,
        model_id: str | None = None,
        filepath: str | None = None,
        topology_json: dict | None = None,
        progress_cb=None,
    ):
        """
        Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization.

        Returns (objects, object_details) — see _build_object_details.
        """
        feeder_id: str | None = None

        if model_id is not None:
            load_stages = [
                ("connectivity nodes", [cim.ConnectivityNode, cim.Terminal]),
                ("lines", [cim.ACLineSegment, cim.ACLineSegmentPhase]),
                ("transformers", [
                    cim.PowerTransformer,
                    cim.TransformerTank,
                    cim.TransformerTankEnd,
                    cim.PowerTransformerEnd,
                    cim.RatioTapChanger,
                ]),
                ("distribution areas", [
                    cim.DistributionArea,
                    cim.FeederArea,
                    cim.SwitchArea,
                    cim.SecondaryArea,
                ]),
                ("loads", [cim.EnergyConsumer, cim.ConformLoad, cim.NonConformLoad]),
                ("generation & storage", [
                    cim.RotatingMachine,
                    cim.SynchronousMachine,
                    cim.AsynchronousMachine,
                    cim.EnergySource,
                    cim.ShuntCompensator,
                    cim.LinearShuntCompensator,
                    cim.SeriesCompensator,
                    cim.PowerElectronicsConnection,
                    cim.BatteryUnit,
                ]),
                ("switches", [
                    cim.Breaker,
                    cim.Fuse,
                    cim.Switch,
                    cim.Sectionaliser,
                    cim.LoadBreakSwitch,
                    cim.Disconnector,
                    cim.Recloser,
                ]),
                ("measurements", [cim.Analog, cim.Discrete]),
            ]
            total_steps = len(load_stages) + 2  # + feeder graph + coordinates

            def report(stage: str, step: int):
                if progress_cb is not None:
                    progress_cb({
                        "model": model_id,
                        "stage": stage,
                        "step": step,
                        "total": total_steps,
                    })

            feeder_id = model_id
            report("feeder graph", 1)
            self.FEEDERS[feeder_id] = self._get_cim_feeder(model_id=model_id)

            for index, (stage, cim_classes) in enumerate(load_stages, start=2):
                report(stage, index)
                for cim_class in cim_classes:
                    self.FEEDERS[feeder_id].get_all_edges(cim_class)

            report("coordinates", total_steps)
            cim_utils.get_all_location_data(self.FEEDERS[feeder_id])
        elif filepath is not None:
            # For regular CIM file reading without multi-feeder support
            # Hosted mode is model exploration only, so it never parses the
            # measurements it has no feature to spend them on.
            xml_reader = MeasurementFreeXMLFile if HOSTED_MODE else XMLFile
            cim_file = xml_reader(filepath)
            filename = os.path.basename(filepath)
            self.FEEDERS[filename] = FeederModel(container=cim.Feeder(), connection=cim_file)
            feeder_id = filename

        objects = []

        TYPES = {
            "RotatingMachine": "diesel_dg",
            "SynchronousMachine": "diesel_dg",
            "AsynchronousMachine": "diesel_dg",
            "EnergySource": "diesel_dg",
            "ShuntCompensator": "capacitor",
            "LinearShuntCompensator": "capacitor",
            "SeriesCompensator": "capacitor",
            "PowerElectronicsConnection": "inverter_dyn",
            "EnergyConsumer": "load",
            "ConformLoad": "load",
            "NonConformLoad": "load",
        }

        # Track equipment we've already emitted as a node so the same
        # single-terminal device isn't added twice if it shows up on
        # multiple connectivity nodes.
        seen_equipment: set = set()
        if topology_json:
            area_map = self._build_topology_area_map(topology_json, feeder_id)
        else:
            area_map = self._build_distribution_area_map(feeder_id)

        # Kept for the lifetime of the load so /api/gridappsd/agents can rebuild
        # the area hierarchy without re-querying Blazegraph.
        self.area_maps[feeder_id] = area_map

        for node in self.FEEDERS[feeder_id].graph.get(cim.ConnectivityNode, {}).values():
            new_node = {
                "objectType": "connectivity_node",
                "elementType": "node",
                "attributes": {
                    "id": node.mRID,
                    "name": node.name if node.name else "",
                    "feeder_id": feeder_id,
                },
            }

            # Stamp the node with the feeder/switch/secondary area ids it belongs
            # to (plus a dist_areas list for the area tree and hover tooltip).
            new_node["attributes"].update(self._area_attrs(area_map.get(node.mRID)))

            coordinates = self.find_shared_coordinates(node)
            if coordinates["x"] is not None and coordinates["y"] is not None:
                new_node["attributes"]["x"] = coordinates["x"]
                new_node["attributes"]["y"] = coordinates["y"]

            for terminal in node.Terminals:
                # equipment is the actual cim object ex: ShuntCompensator
                equipment = terminal.ConductingEquipment
                if equipment is not None:
                    class_type = equipment.__class__.__name__

                    if class_type in TYPES and equipment.mRID not in seen_equipment:
                        seen_equipment.add(equipment.mRID)
                        new_obj = {
                            "objectType": TYPES[class_type],
                            "elementType": "node",
                            "attributes": {
                                "id": equipment.mRID,
                                "name": equipment.name if equipment.name else "",
                                "class_type": class_type,
                                "feeder_id": feeder_id,
                            },
                        }

                        new_obj["attributes"].update(self._area_attrs(area_map.get(equipment.mRID)))
                        self._add_attributes(equipment, new_obj)
                        objects.append(new_obj)

                        # Connect the equipment node to the connectivity node with an edge
                        objects.append({
                            "objectType": "line",
                            "elementType": "edge",
                            "attributes": {
                                "id": f"{node.mRID}->{terminal.mRID}",
                                "from": node.mRID,
                                "to": equipment.mRID,
                                "feeder_id": feeder_id,
                                **self._area_attrs(area_map.get(equipment.mRID)),
                            },
                        })

            self._add_attributes(node, new_node)
            objects.append(new_node)

        for line in self.FEEDERS[feeder_id].graph.get(cim.ACLineSegment, {}).values():
            terminals = line.Terminals
            if (
                len(terminals) < 2
                or terminals[0].ConnectivityNode is None
                or terminals[1].ConnectivityNode is None
            ):
                continue

            new_edge = {
                "objectType": self.classify_line(line),
                "elementType": "edge",
                "attributes": {
                    "id": line.mRID,
                    "from": terminals[0].ConnectivityNode.mRID,
                    "to": terminals[1].ConnectivityNode.mRID,
                    "class_type": line.__class__.__name__,
                    "length": line.length,
                    "feeder_id": feeder_id,
                },
            }

            new_edge["attributes"].update(self._area_attrs(area_map.get(line.mRID)))
            self._add_attributes(line, new_edge)
            objects.append(new_edge)

        for p_transformer in self.FEEDERS[feeder_id].graph.get(cim.PowerTransformer, {}).values():
            is_regulator = False
            new_edge = {
                "objectType": "transformer",
                "elementType": "edge",
                "attributes": {
                    "id": p_transformer.mRID,
                    "class_type": p_transformer.__class__.__name__,
                    "feeder_id": feeder_id,
                    "mRID": p_transformer.mRID,
                    "name": p_transformer.name if p_transformer.name is not None else "",
                },
            }

            for terminal in p_transformer.Terminals:
                if terminal.ConnectivityNode is None:
                    continue
                if terminal.sequenceNumber == 1:
                    new_edge["attributes"]["from"] = terminal.ConnectivityNode.mRID
                elif terminal.sequenceNumber == 2:
                    new_edge["attributes"]["to"] = terminal.ConnectivityNode.mRID

            for transformer_end in p_transformer.PowerTransformerEnd:  # windings of a transformer
                if transformer_end.RatioTapChanger is not None:
                    is_regulator = True
                    for phase in ["AN", "BN", "CN"]:
                        new_edge["attributes"][phase] = {
                            "step": transformer_end.RatioTapChanger.step,
                            "tap": transformer_end.RatioTapChanger.mRID,
                        }
                        
                    new_edge["attributes"]["class_type"] = "regulator"
                    break

            if not is_regulator:

                for transformer_tank in p_transformer.TransformerTanks:
                    for tank_end in transformer_tank.TransformerTankEnds:
                        ratio_tap_changer_phase = tank_end.orderedPhases
                        if ratio_tap_changer_phase in [
                            cim.OrderedPhaseCodeKind.AN,
                            cim.OrderedPhaseCodeKind.BN,
                            cim.OrderedPhaseCodeKind.CN,
                        ]:
                            if tank_end.RatioTapChanger is not None:
                                is_regulator = True
                                new_edge["attributes"]["class_type"] = "regulator"
                                new_edge["attributes"][ratio_tap_changer_phase.value] = {
                                    "step": tank_end.RatioTapChanger.step,
                                    "tap": tank_end.RatioTapChanger.mRID,
                                }

            new_edge["attributes"].update(self._area_attrs(area_map.get(p_transformer.mRID)))
            objects.append(new_edge)

        cim_switch_types = [
            cim.Breaker,
            cim.Fuse,
            cim.Switch,
            cim.Sectionaliser,
            cim.LoadBreakSwitch,
            cim.Disconnector,
            cim.Recloser,
        ]

        for cim_type in cim_switch_types:
            if cim_type in self.FEEDERS[feeder_id].graph:
                for switch_obj in self.FEEDERS[feeder_id].graph[cim_type].values():
                    switch_terminals = switch_obj.Terminals
                    if (
                        len(switch_terminals) < 2
                        or switch_terminals[0].ConnectivityNode is None
                        or switch_terminals[1].ConnectivityNode is None
                    ):
                        continue

                    # Collect measurement MRIDs associated with this switch
                    measurement_mrids = []
                    if hasattr(switch_obj, "Measurements") and switch_obj.Measurements:
                        for m in switch_obj.Measurements:
                            if m.mRID:
                                measurement_mrids.append(str(m.mRID))

                    normal_open = (
                        bool(switch_obj.normalOpen)
                        if switch_obj.normalOpen is not None
                        else False
                    )
                    switch_status = (
                        bool(switch_obj.open)
                        if switch_obj.open is not None
                        else normal_open
                    )
                    rated_current = (
                        str(switch_obj.ratedCurrent)
                        if switch_obj.ratedCurrent is not None
                        else None
                    )

                    new_edge = {
                        "objectType": "switch",
                        "elementType": "edge",
                        "attributes": {
                            "id": switch_obj.mRID,
                            "from": switch_terminals[0].ConnectivityNode.mRID,
                            "to": switch_terminals[1].ConnectivityNode.mRID,
                            "class_type": switch_obj.__class__.__name__,
                            "normalStatus": "OPEN" if normal_open else "CLOSED",
                            "open": switch_status,
                            "ratedCurrent": rated_current,
                            "measurement_mrids": measurement_mrids,
                            "feeder_id": feeder_id,
                        },
                    }

                    if hasattr(switch_obj, "breakingCapacity") and switch_obj.breakingCapacity is not None:
                        new_edge["attributes"]["breakingCapacity"] = str(switch_obj.breakingCapacity)

                    new_edge["attributes"].update(self._area_attrs(area_map.get(switch_obj.mRID)))
                    self._add_attributes(switch_obj, new_edge)
                    objects.append(new_edge)

        for battery in self.FEEDERS[feeder_id].graph.get(cim.BatteryUnit, {}).values():
            new_battery = {
                "objectType": "battery",
                "elementType": "node",
                "attributes": {
                    "id": battery.mRID,
                    "name": battery.name,
                    "class_type": battery.__class__.__name__,
                    "feeder_id": feeder_id,
                },
            }

            battery_area_attrs = self._area_attrs(area_map.get(battery.mRID))
            new_battery["attributes"].update(battery_area_attrs)
            self._add_attributes(battery, new_battery)
            objects.append(new_battery)

            pec = battery.PowerElectronicsConnection
            if pec is None or len(pec.Terminals) < 1 or pec.Terminals[0].ConnectivityNode is None:
                continue

            from_id = pec.Terminals[0].ConnectivityNode.mRID
            to_id = battery.mRID

            new_edge = {
                "objectType": "line",
                "elementType": "edge",
                "attributes": {
                    "id": f"{from_id}->{to_id}",
                    "from": from_id,
                    "to": to_id,
                    "feeder_id": feeder_id,
                    **battery_area_attrs,
                },
            }
            objects.append(new_edge)

        # Build measurement map: measurement MRID -> equipment info
        # This is used to map simulation output measurements to CIM objects.
        # Hosted mode has no simulation and no measurements parsed, so there is
        # nothing to map.
        if not HOSTED_MODE:
            self._build_measurement_map(feeder_id)
        self.object_index[feeder_id] = {
            obj["attributes"]["id"]: {
                "name": obj["attributes"].get("name", ""),
                "objectType": obj["objectType"],
                "elementType": obj["elementType"],
                "class_type": obj["attributes"].get("class_type", ""),
                "phases": str(obj["attributes"].get("phases", "")),
            }
            for obj in objects
            if obj.get("attributes", {}).get("id")
        }

        return objects, self._build_object_details(feeder_id, objects)

    def _build_object_details(self, feeder_id: str, objects: list) -> dict:
        if self.FEEDERS.get(feeder_id) is None:
            return {}

        details: dict[str, dict] = {}
        for obj in objects:
            mrid = obj.get("attributes", {}).get("id")
            if not mrid or mrid in details or "->" in str(mrid):
                continue
            cim_obj = self.resolve_object(feeder_id, mrid)
            if cim_obj is None:
                continue
            details[mrid] = self._object_to_detail(cim_obj)

        return details

    def _area_attrs(self, record: dict | None) -> dict:
        if not record:
            return {}

        attrs = dict(record)
        dist_areas = []
        for level, type_name in (
            ("feeder_area", "FeederArea"),
            ("switch_area", "SwitchArea"),
            ("secondary_area", "SecondaryArea"),
        ):
            area_id = record.get(f"{level}_id")
            if area_id:
                dist_areas.append({
                    "dist_area_type": type_name,
                    "dist_area_id": area_id,
                    "dist_area_name": record.get(f"{level}_name", ""),
                })
        attrs["dist_areas"] = dist_areas
        return attrs

    @staticmethod
    def _uuid_tail(mrid) -> str:
        return str(mrid).split("-")[-1]

    def _build_distribution_area_map(self, feeder_id: str) -> dict:
        graph = self.FEEDERS[feeder_id].graph
        area_by_mrid: dict = {}

        for feeder_area in graph.get(cim.FeederArea, {}).values():
            feeder_ctx = {
                "feeder_area_id": feeder_area.mRID,
                "feeder_area_name": feeder_area.name or self._uuid_tail(feeder_area.mRID),
            }
            self._tag_cim_area_members(feeder_area, feeder_ctx, area_by_mrid)

            for switch_area in getattr(feeder_area, "SwitchAreas", None) or []:
                switch_ctx = {
                    **feeder_ctx,
                    "switch_area_id": switch_area.mRID,
                    "switch_area_name": switch_area.name or self._uuid_tail(switch_area.mRID),
                }
                self._tag_cim_area_members(switch_area, switch_ctx, area_by_mrid)

                for secondary_area in getattr(switch_area, "SecondaryAreas", None) or []:
                    secondary_ctx = {
                        **switch_ctx,
                        "secondary_area_id": secondary_area.mRID,
                        "secondary_area_name": secondary_area.name
                        or self._uuid_tail(secondary_area.mRID),
                    }
                    self._tag_cim_area_members(secondary_area, secondary_ctx, area_by_mrid)

        return area_by_mrid

    def _tag_cim_area_members(self, area, context: dict, area_by_mrid: dict) -> None:
        """Stamp the ancestry context onto every mRID a CIM area object reaches."""
        mrids: set = set()

        for equipment in getattr(area, "ContainedEquipment", None) or []:
            mrids.add(equipment.mRID)  # the equipment itself (edge / equipment-node)
            for terminal in getattr(equipment, "Terminals", None) or []:
                cn = terminal.ConnectivityNode
                if cn is not None:
                    mrids.add(cn.mRID)

        for terminal in getattr(area, "BoundaryTerminals", None) or []:
            cn = terminal.ConnectivityNode
            if cn is not None:
                mrids.add(cn.mRID)

        for mrid in mrids:
            area_by_mrid.setdefault(mrid, {}).update(context)

    @staticmethod
    def _norm_mrid(mrid) -> str:
        """Normalize an mRID for dict-key comparison (case + legacy '_' prefix)."""
        return str(mrid).lstrip("_").lower()

    def _build_mrid_index(self, feeder_id: str) -> dict:
        cached = self._mrid_indexes.get(feeder_id)
        if cached is not None:
            return cached

        index: dict = {}
        graph = self.FEEDERS[feeder_id].graph
        # mRID first and allowed to overwrite, preserving the resolution this
        # index had when it only held mRIDs; `identifier` then fills gaps only,
        # so an alias can never displace an object already registered.
        for instances in graph.values():
            for obj in instances.values():
                mrid = getattr(obj, "mRID", None)
                if mrid:
                    index[self._norm_mrid(mrid)] = obj
        for instances in graph.values():
            for obj in instances.values():
                identifier = getattr(obj, "identifier", None)
                if identifier:
                    index.setdefault(self._norm_mrid(identifier), obj)

        self._mrid_indexes[feeder_id] = index
        return index

    def _invalidate_index(self, feeder_id: str) -> None:
        """Drop a feeder's cached index after the graph is mutated."""
        self._mrid_indexes.pop(feeder_id, None)

    def resolve_object(self, feeder_id: str, uuid) -> object | None:
        """The CIM instance for an id, or None. Never touches SPARQL or the XML."""
        feeder = self.FEEDERS.get(feeder_id)
        if feeder is None or not uuid:
            return None
        return self._build_mrid_index(feeder_id).get(self._norm_mrid(uuid))

    def _lookup_mrid(self, feeder_id: str, mrid_index: dict, mrid) -> object | None:
        """Resolve an mRID via the in-memory index; fall back to a live
        get_object query only for references the bulk load didn't cover."""
        if not mrid:
            return None
        obj = mrid_index.get(self._norm_mrid(mrid))
        if obj is not None:
            return obj
        try:
            return self.FEEDERS[feeder_id].get_object(mrid)
        except Exception:
            return None

    def _resolve_area_name(self, feeder_id: str, area_mrid: str, mrid_index: dict) -> str:
        obj = self._lookup_mrid(feeder_id, mrid_index, area_mrid)
        name = getattr(obj, "name", None) if obj is not None else None
        if name:
            return name

        return self._uuid_tail(area_mrid)

    def _build_topology_area_map(self, topology_json: dict, feeder_id: str) -> dict:
        area_by_mrid: dict = {}
        distribution_area = (topology_json or {}).get("DistributionArea", {})

        mrid_index = self._build_mrid_index(feeder_id)

        for substation in distribution_area.get("Substations", []) or []:
            for feeder in substation.get("NormalEnergizedFeeder", []) or []:
                feeder_area = feeder.get("FeederArea")
                if not feeder_area:
                    continue

                feeder_ctx = self._topology_area_context(
                    feeder_area, feeder_id, "feeder_area", mrid_index
                )
                self._tag_topology_area_members(
                    feeder_area, feeder_ctx, feeder_id, area_by_mrid, mrid_index
                )

                for switch_area in feeder_area.get("SwitchAreas", []) or []:
                    switch_ctx = {
                        **feeder_ctx,
                        **self._topology_area_context(
                            switch_area, feeder_id, "switch_area", mrid_index
                        ),
                    }
                    self._tag_topology_area_members(
                        switch_area, switch_ctx, feeder_id, area_by_mrid, mrid_index
                    )

                    for secondary_area in switch_area.get("SecondaryAreas", []) or []:
                        secondary_ctx = {
                            **switch_ctx,
                            **self._topology_area_context(
                                secondary_area, feeder_id, "secondary_area", mrid_index
                            ),
                        }
                        self._tag_topology_area_members(
                            secondary_area, secondary_ctx, feeder_id, area_by_mrid, mrid_index
                        )

        return area_by_mrid

    def _topology_area_context(
        self, area: dict, feeder_id: str, level: str, mrid_index: dict
    ) -> dict:
        """Build the {<level>_id, <level>_name} pair for one topology-area dict."""
        area_id = area.get("@id")
        if not area_id:
            return {}
        return {
            f"{level}_id": area_id,
            f"{level}_name": self._resolve_area_name(feeder_id, area_id, mrid_index),
        }

    def _tag_topology_area_members(
        self, area: dict, context: dict, feeder_id: str, area_by_mrid: dict, mrid_index: dict
    ) -> None:
        """Stamp the ancestry context onto every mRID a topology-area dict reaches."""
        mrids: set = set()

        # Equipment: tag the equipment's own mRID (edges / equipment-nodes) and the
        # connectivity nodes on its terminals.
        for key in ("AddressableEquipment", "UnaddressableEquipment"):
            for entry in area.get(key, []) or []:
                equipment = self._lookup_mrid(feeder_id, mrid_index, entry.get("@id"))
                if equipment is None:
                    continue
                mrids.add(equipment.mRID)
                for terminal in getattr(equipment, "Terminals", None) or []:
                    cn = terminal.ConnectivityNode
                    if cn is not None:
                        mrids.add(cn.mRID)

        # BoundaryTerminals -> ConnectivityNode
        for entry in area.get("BoundaryTerminals", []) or []:
            terminal = self._lookup_mrid(feeder_id, mrid_index, entry.get("@id"))
            if terminal is None:
                continue
            cn = getattr(terminal, "ConnectivityNode", None)
            if cn is not None:
                mrids.add(cn.mRID)

        for mrid in mrids:
            area_by_mrid.setdefault(mrid, {}).update(context)

    def _build_measurement_map(self, feeder_id: str) -> dict:
        measurement_types = [cim.Analog, cim.Discrete]
        for measurement_type in measurement_types:
            if measurement_type not in self.FEEDERS[feeder_id].graph:
                continue

            for measurement in self.FEEDERS[feeder_id].graph[measurement_type].values():
                if not measurement.mRID:
                    continue

                # Analog or Discrete
                measurement_class = measurement.__class__.__name__

                entry = {
                    "measurement_mrid": measurement.mRID,
                    "name": measurement.name if measurement.name else "",
                    "measurement_type": measurement.measurementType,
                    "phases": str(measurement.phases) if measurement.phases else "",
                    "measurement_class": measurement_class
                }

                # Link to conducting equipment via Terminal
                if measurement.Terminal and measurement.Terminal.ConductingEquipment:
                    equipment = measurement.Terminal.ConductingEquipment
                    entry["conducting_equipment_mrid"] = str(equipment.mRID) if equipment.mRID else ""
                    entry["conducting_equipment_name"] = equipment.name if equipment.name else ""
                    entry["conducting_equipment_type"] = equipment.__class__.__name__

                if measurement.Terminal and measurement.Terminal.ConnectivityNode:
                    cn = measurement.Terminal.ConnectivityNode
                    entry["connectivity_node_mrid"] = str(cn.mRID) if cn.mRID else ""

                if measurement.PowerSystemResource and "conducting_equipment_mrid" not in entry:
                    psr = measurement.PowerSystemResource
                    entry["conducting_equipment_mrid"] = str(psr.mRID) if psr.mRID else ""
                    entry["conducting_equipment_name"] = psr.name if psr.name else ""
                    entry["conducting_equipment_type"] = psr.__class__.__name__

                self.active_measurement_map[measurement_class][measurement.mRID] = entry


    def get_measurement_catalog(self) -> list:
        catalog = []
        for measurement_class in ("Analog", "Discrete"):
            for entry in self.active_measurement_map.get(measurement_class, {}).values():
                catalog.append({
                    "measurement_mrid": entry.get("measurement_mrid", ""),
                    "measurement_type": entry.get("measurement_type", ""),
                    "equipment_name": entry.get("conducting_equipment_name", ""),
                    "equipment_type": entry.get("conducting_equipment_type", ""),
                    "phases": entry.get("phases", ""),
                })
        return catalog


    def _object_to_detail(self, obj):
        if not obj:
            return {}

        detail = {
            "identifier": str(
                getattr(obj, "identifier", getattr(obj, "mRID", "unknown"))
            ),
            "class_name": obj.__class__.__name__,
            "display_name": getattr(
                obj, "name", str(getattr(obj, "identifier", "unnamed"))
            ),
            "attributes": {},
            "associations": {},
        }

        # Get all dataclass fields if this is a dataclass
        if is_dataclass(obj):
            for field in fields(obj):
                value = getattr(obj, field.name, None)
                if value is not None:
                    if field.metadata.get("type") == "Association":
                        # This is a relationship to another object
                        if hasattr(value, "identifier"):
                            detail["associations"][field.name] = str(value.identifier)
                        else:
                            detail["associations"][field.name] = str(value)
                    else:
                        # This is a simple attribute
                        detail["attributes"][field.name] = str(value)

        return detail

    def get_cim_object(self, feeder_id: str, uuid: str):
        if not self.FEEDERS[feeder_id]:
            return {"error": "No active model available"}  # 400

        obj = self.resolve_object(feeder_id, uuid)
        if obj is None:
            return {"error": f"Object {uuid} not found"}  # 404
        return {"uuid": uuid, "object": self._object_to_detail(obj)}

    def new_bus_location(
        self,
        network: FeederModel,
        node: cim.ConnectivityNode,
        xPosition: float,
        yPosition: float,
    ):
        for terminal in node.Terminals:
            equipment = terminal.ConductingEquipment
            location = equipment.Location
            if location is None:
                name = f"${equipment.name}_location"
                location = cim.Location(name=name)
                equipment.Location = location
                location.PowerSystemResources.append(equipment)
                network.add_to_graph(location)

            point = cim.PositionPoint()
            point.sequenceNumber = terminal.sequenceNumber
            point.xPosition = xPosition
            point.yPosition = yPosition
            point.Location = location
            location.PositionPoints.append(point)
            network.add_to_graph(point)

    def export_cim_coords(
        self, feeder_id: str, new_coords_obj: list, output_path: str
    ) -> None:
        for obj in new_coords_obj:
            c_node = self.FEEDERS[feeder_id].graph[cim.ConnectivityNode][
                UUID(obj["mRID"].upper())
            ]
            self.new_bus_location(
                network=self.FEEDERS[feeder_id],
                node=c_node,
                xPosition=obj["x"],
                yPosition=obj["y"],
            )

        cim_utils.get_all_data(self.FEEDERS[feeder_id])
        cim_utils.write_xml(self.FEEDERS[feeder_id], output_path)

    def find_shared_coordinates(self, cim_obj) -> dict:
        candidates = []
        for terminal in cim_obj.Terminals:
            equipment = terminal.ConductingEquipment
            if equipment is None or equipment.Location is None:
                continue

            points = [
                point
                for point in equipment.Location.PositionPoints
                if point.xPosition is not None and point.yPosition is not None
            ]
            if not points:
                continue

            points.sort(key=lambda p: p.sequenceNumber if p.sequenceNumber is not None else 0)
            point = points[0] if terminal.sequenceNumber == 1 else points[-1]

            try:
                candidates.append((float(point.xPosition), float(point.yPosition)))
            except (TypeError, ValueError):
                continue

        if not candidates:
            return {"x": None, "y": None}

        # Prefer the point where the most equipment endpoints agree; if none
        # repeat, fall back to the first terminal's endpoint.
        x, y = max(candidates, key=candidates.count)
        return {"x": x, "y": y}

    def _add_attributes(self, cim_obj, new_obj):
        dense_fields = [
            "ConnectivityNode",
            "ConductingEquipment",
            "ConnectivityNodeContainer",
            "Location",
            "PowerElectronicsConnection",
            "PerLengthImpedance",
            "PowerTransformer",
            "TransformerEnds",
            "BaseVoltage",
            "VoltageLevel",
            "TransformerTankInfo",
            "LoadResponse",
            "RegulatingControl",
            "GeneratingUnit",
            "WireSpacingInfo"
        ]

        for field in fields(cim_obj):
            if field.name == "identifier":
                continue

            if field.metadata.get("type") == "Attribute":  # association, aggregateof, and ofaggregate
                attribute = getattr(cim_obj, field.name)
                if field.name in dense_fields and attribute is not None:
                    if isinstance(attribute, list):
                        new_obj["attributes"][field.name] = len(attribute)
                    else:
                        new_obj["attributes"][field.name] = str(attribute.name)
                elif attribute is not None:
                    new_obj["attributes"][field.name] = str(attribute)

    # def export_cim(
    #     self, feeder_id: str, dir2save: str, filename: str, data: list
    # ) -> None:
    #     if len(data) == 0:
    #         cim_utils.get_all_data(self.FEEDERS[feeder_id])
    #         cim_utils.write_xml(self.FEEDERS[feeder_id], dir2save + "\\cim_output.xml")
    #         return

    #     feeder = self.FEEDERS[feeder_id].container

    #     # [0] = new nerminal with type
    #     # [1] = new connectivity node
    #     # [2] = existing connectivity node

    #     for nodeObj in data:
    #         # 1. get existing connectivity node
    #         existing_c_node = self.FEEDERS[feeder_id].graph[cim.ConnectivityNode][
    #             UUID(nodeObj[2]["mRID"].upper())
    #         ]

    #         # 2. create new connectivity node
    #         new_c_node = cim.ConnectivityNode(
    #             mRID=nodeObj[1]["mRID"].upper(), name=nodeObj[1]["name"]
    #         )
    #         self.FEEDERS[feeder_id].add_to_graph(new_c_node)

    #         # 3. connect both connectivity nodes with new_two_terminal_obj function
    #         new_two_terminal_object(
    #             network=self.FEEDERS[feeder_id],
    #             container=feeder,
    #             class_type=cim.ACLineSegment,
    #             name=existing_c_node.mRID.split("-")[0],
    #             node1=existing_c_node,
    #             node2=new_c_node,
    #         )

    #         # 4. Finally create the new synchronous generator or energy consumer by connecting to new connectivity node
    #         if nodeObj[0]["type"] == "diesel_dg":
    #             new_synchronous_generator(
    #                 network=self.FEEDERS[feeder_id],
    #                 container=feeder,
    #                 name=nodeObj[0]["name"],
    #                 node=new_c_node,
    #             )
    #         elif nodeObj[0]["type"] == "load":
    #             new_energy_consumer(
    #                 network=self.FEEDERS[feeder_id],
    #                 container=feeder,
    #                 name=nodeObj[0]["name"],
    #                 node=new_c_node,
    #             )
    #         elif nodeObj[0]["type"] == "inverter_dyn":
    #             # new power electronics connection
    #             pass
    #         elif nodeObj[0]["type"] == "capacitor":
    #             # new one terminal object
    #             pass

    #     out_dir = os.path.join(
    #         dir2save, os.path.splitext(os.path.basename(filename))[0] + "_out.xml"
    #     )
    #     cim_utils.get_all_data(self.FEEDERS[feeder_id])
    #     cim_utils.write_xml(self.FEEDERS[feeder_id], out_dir)

    def get_mermaid(self, feeder_id: str, uuid: str) -> str:
        obj = self.resolve_object(feeder_id, uuid)
        if obj is None:
            return json.dumps({"uuid": uuid, "error": f"Object {uuid} not found"})

        try:
            mermaid_diagram = cim_utils.get_mermaid(obj)
            return json.dumps({"uuid": uuid, "mermaid": mermaid_diagram})
        except (ImportError, AttributeError):
            # Fallback: create simple mermaid diagram
            mermaid = f"graph TD\n    {uuid}[{obj.__class__.__name__}]\n"
            return json.dumps({"uuid": uuid, "mermaid": mermaid})

    def delete_cim_object(self, feeder_id: str, uuid: str) -> bool:
        if not self.FEEDERS[feeder_id]:
            return False

        # Get the object first
        obj = None
        obj_class = None
        obj_key = None

        obj = self.resolve_object(feeder_id, uuid)
        if obj is None:
            # Manual search
            for cim_class, instances in self.FEEDERS[feeder_id].graph.items():
                for key, instance in instances.items():
                    obj_id = str(
                        getattr(instance, "identifier", getattr(instance, "mRID", ""))
                    )
                    if obj_id == uuid:
                        obj = instance
                        obj_class = cim_class
                        obj_key = key
                        break
                if obj:
                    break

        if not obj:
            return False

        # Delete the object. Either branch mutates the graph, so the cached
        # index must go with it or a deleted object stays resolvable.
        if hasattr(self.FEEDERS[feeder_id], "delete"):
            self.FEEDERS[feeder_id].delete(obj)
            self._invalidate_index(feeder_id)
            return True
        elif obj_class and obj_key:
            del self.FEEDERS[feeder_id].graph[obj_class][obj_key]
            self._invalidate_index(feeder_id)
            return True

        return False
