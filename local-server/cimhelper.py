import os
import json
import traceback

from concurrent.futures import ThreadPoolExecutor

from uuid import UUID
from dataclasses import fields, is_dataclass

# from cimbuilder.object_builder.new_energy_consumer import new_energy_consumer
# from cimbuilder.object_builder import new_synchronous_generator, new_two_terminal_object

# CIM-graph imports
# from cimgraph.databases.gridappsd import GridappsdConnection
from cimgraph.databases.blazegraph.blazegraph import BlazegraphConnection
from cimgraph.models.feeder_model import FeederModel
import cimgraph.utils as cim_utils
from cimgraph.databases.fileparsers.xml_parser import XMLFile
import cimgraph.data_profile.cimhub_2023 as cim

#   Web UI:        http://localhost:8080/
#   Blazegraph:    http://localhost:8889/bigdata/
#   STOMP:         tcp://localhost:61613
#   WebSocket:     ws://localhost:61614
#   OpenWire:      tcp://localhost:61616

# Environment setup
os.environ["CIMG_CIM_PROFILE"] = "cimhub_2023"
os.environ["CIMG_URL"] = "http://localhost:8889/bigdata/namespace/kb/sparql"
os.environ["CIMG_DATABASE"] = "powergridmodel"
os.environ["CIMG_HOST"] = "localhost"
os.environ["CIMG_PORT"] = "61613"
os.environ["CIMG_USERNAME"] = "test_app_user"
os.environ["CIMG_PASSWORD"] = "4Test"
os.environ["CIMG_NAMESPACE"] = "http://iec.ch/TC57/CIM100#"
os.environ["CIMG_IEC61970_301"] = "8"
os.environ["CIMG_USE_UNITS"] = "False"


# Current CIM network model - this holds the main graph data
class CIMHelper:
    def __init__(self) -> None:
        self.active_measurement_map: dict = {"Discrete": {}, "Analog": {}}

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
        database = BlazegraphConnection()
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
    ):
        """
        topology_outputs: optional { key -> GridAPPS-D topology-service JSON },
        where key is the model id (for model_IDs) or the file basename (for
        filepaths). When a model's topology output is present, distribution
        areas are sourced from it; otherwise they fall back to the CIM model.
        """
        topology_outputs = topology_outputs or {}
        self.active_measurement_map = {"Discrete": {}, "Analog": {}}  # Reset measurement map for new model(s)
        if model_IDs is not None:
            gjs = {id: {"objects": []} for id in model_IDs}

            for id in model_IDs:
                gjs[id]["objects"] = self._parse_model(
                    model_id=id, topology_json=topology_outputs.get(id)
                )

            return gjs

        if filepaths is not None:
            gjs = { os.path.basename(path): {"objects": []} for path in filepaths }

            for path in filepaths:
                filename = os.path.basename(path)
                gjs[filename]["objects"] = self._parse_model(
                    filepath=path, topology_json=topology_outputs.get(filename)
                )

            return gjs

    def _parse_model(
        self,
        model_id: str | None = None,
        filepath: str | None = None,
        topology_json: dict | None = None,
    ):
        """
        Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
        """
        self.FEEDERS: dict[str, FeederModel] = {}
        feeder_id: str | None = None

        if model_id is not None:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._get_cim_feeder, model_id=model_id)
            try:
                feeder_id = model_id
                self.FEEDERS[feeder_id] = future.result(timeout=60)
                # cim_utils.get_all_bus_data(self._FEEDERS[feeder_id])
                self.FEEDERS[feeder_id].get_all_edges(cim.ConnectivityNode)
                self.FEEDERS[feeder_id].get_all_edges(cim.Terminal)

                # cim_utils.get_all_line_data(self._FEEDERS[feeder_id])
                self.FEEDERS[feeder_id].get_all_edges(cim.ACLineSegment)
                self.FEEDERS[feeder_id].get_all_edges(cim.ACLineSegmentPhase)
                self.FEEDERS[feeder_id].get_all_edges(cim.OverheadWireInfo)
                self.FEEDERS[feeder_id].get_all_edges(cim.ConcentricNeutralCableInfo)
                self.FEEDERS[feeder_id].get_all_edges(cim.TapeShieldCableInfo)

                # cim_utils.get_all_transformer_data(self._FEEDERS[feeder_id])
                self.FEEDERS[feeder_id].get_all_edges(cim.PowerTransformer)
                self.FEEDERS[feeder_id].get_all_edges(cim.TransformerTank)
                self.FEEDERS[feeder_id].get_all_edges(cim.TransformerTankEnd)
                self.FEEDERS[feeder_id].get_all_edges(cim.PowerTransformerEnd)
                self.FEEDERS[feeder_id].get_all_edges(cim.RatioTapChanger)

                # Distribution areas (for area highlighting in the frontend).
                # Load most-general to most-specific; the area->node map below
                # resolves the tightest containing area for each node.
                self.FEEDERS[feeder_id].get_all_edges(cim.DistributionArea)
                self.FEEDERS[feeder_id].get_all_edges(cim.FeederArea)
                self.FEEDERS[feeder_id].get_all_edges(cim.SwitchArea)
                self.FEEDERS[feeder_id].get_all_edges(cim.SecondaryArea)

                # cim_utils.get_all_load_data(self._FEEDERS[feeder_id])
                self.FEEDERS[feeder_id].get_all_edges(cim.EnergyConsumer)
                self.FEEDERS[feeder_id].get_all_edges(cim.ConformLoad)
                self.FEEDERS[feeder_id].get_all_edges(cim.NonConformLoad)

                self.FEEDERS[feeder_id].get_all_edges(cim.RotatingMachine)
                self.FEEDERS[feeder_id].get_all_edges(cim.SynchronousMachine)
                self.FEEDERS[feeder_id].get_all_edges(cim.AsynchronousMachine)
                self.FEEDERS[feeder_id].get_all_edges(cim.EnergySource)

                self.FEEDERS[feeder_id].get_all_edges(cim.ShuntCompensator)
                self.FEEDERS[feeder_id].get_all_edges(cim.LinearShuntCompensator)
                self.FEEDERS[feeder_id].get_all_edges(cim.SeriesCompensator)

                # cim_utils.get_all_inverter_data(self._FEEDERS[feeder_id])
                self.FEEDERS[feeder_id].get_all_edges(cim.PowerElectronicsConnection)
                self.FEEDERS[feeder_id].get_all_edges(cim.BatteryUnit)

                # Switch types
                self.FEEDERS[feeder_id].get_all_edges(cim.Breaker)
                self.FEEDERS[feeder_id].get_all_edges(cim.Fuse)
                self.FEEDERS[feeder_id].get_all_edges(cim.Switch)
                self.FEEDERS[feeder_id].get_all_edges(cim.Sectionaliser)
                self.FEEDERS[feeder_id].get_all_edges(cim.LoadBreakSwitch)
                self.FEEDERS[feeder_id].get_all_edges(cim.Disconnector)
                self.FEEDERS[feeder_id].get_all_edges(cim.Recloser)

                # Measurements (needed to map simulation output to equipment)
                self.FEEDERS[feeder_id].get_all_edges(cim.Analog)
                self.FEEDERS[feeder_id].get_all_edges(cim.Discrete)
                self.FEEDERS[feeder_id].get_all_edges(cim.Measurement)

                # cim_utils.get_all_limit_data(self._FEEDERS[feeder_id])
                cim_utils.get_all_location_data(self.FEEDERS[feeder_id])
            except Exception as e:
                tb = traceback.format_exc()
                print(tb)
                return {"error": "Database connection timeout", "traceback": tb}
        elif filepath is not None:
            # For regular CIM file reading without multi-feeder support
            cim_file = XMLFile(filepath)
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

        # Map every connectivity node AND equipment mRID to its full distribution
        # area ancestry (feeder / switch / secondary ids + names). Prefer the
        # GridAPPS-D topology-service output when provided; otherwise derive the
        # areas straight from the CIM model. Applied to both nodes and edges so
        # area highlighting can grey out everything outside the selected areas.
        if topology_json:
            area_map = self._build_topology_area_map(topology_json, feeder_id)
        else:
            area_map = self._build_distribution_area_map(feeder_id)

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
                                "id": f"{node.mRID}_{terminal.mRID}",
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
                    "id": f"{from_id}-{to_id}",
                    "from": from_id,
                    "to": to_id,
                    "feeder_id": feeder_id,
                    **battery_area_attrs,
                },
            }
            objects.append(new_edge)

        # Build measurement map: measurement MRID -> equipment info
        # This is used to map simulation output measurements to CIM objects
        self._build_measurement_map(feeder_id)

        return objects

    def _area_attrs(self, record: dict | None) -> dict:
        """
        Convert an ancestry record (feeder/switch/secondary ids + names) into the
        attribute fields stored on a node or edge: the flat <level>_area_id /
        <level>_area_name fields used for nesting-aware matching, plus a dist_areas
        list (general -> specific) used for the area tree and hover tooltip.
        """
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
        """
        Map every connectivity node AND equipment mRID to the full distribution-area
        ancestry containing it, sourced from the CIM area objects.

        The model nests areas as FeederArea -> SwitchArea -> SecondaryArea. Walking
        top-down lets every member carry the id/name of each ancestor level, so a
        node/edge inside a SecondaryArea also records its parent SwitchArea and
        FeederArea. That is what lets the frontend highlight a SwitchArea and have
        its SecondaryArea members light up too.

        A node/edge is "in" an area if it is the area's ContainedEquipment (edges +
        single-terminal equipment, keyed by their own mRID), is a connectivity node
        on that equipment's terminals, or sits on one of the area's BoundaryTerminals.

        Returns: { mRID: {feeder_area_id, feeder_area_name, switch_area_id, ...} }
        """
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

    def _resolve_area_name(self, feeder_id: str, area_mrid: str) -> str:
        """
        The GridAPPS-D topology output carries no area names, so try to read the
        name from the corresponding CIM object in the loaded model; if that
        isn't available, fall back to the last segment of the mRID UUID.
        """
        try:
            obj = self.FEEDERS[feeder_id].get_object(area_mrid)
        except Exception:
            obj = None

        name = getattr(obj, "name", None) if obj is not None else None
        if name:
            return name

        return self._uuid_tail(area_mrid)

    def _build_topology_area_map(self, topology_json: dict, feeder_id: str) -> dict:
        """
        Same result as _build_distribution_area_map, but sourced from the GridAPPS-D
        topology service output (the "GET_DISTRIBUTED_AREAS" shape, identical to
        ieee123_topo.json) instead of the CIM area objects.

        The topology JSON only references equipment / terminal mRIDs, which are
        resolved back to the loaded model so each member records its full ancestry
        (FeederArea -> SwitchArea -> SecondaryArea).

        Returns: { mRID: {feeder_area_id, feeder_area_name, switch_area_id, ...} }
        """
        area_by_mrid: dict = {}
        distribution_area = (topology_json or {}).get("DistributionArea", {})

        for substation in distribution_area.get("Substations", []) or []:
            for feeder in substation.get("NormalEnergizedFeeder", []) or []:
                feeder_area = feeder.get("FeederArea")
                if not feeder_area:
                    continue

                feeder_ctx = self._topology_area_context(feeder_area, feeder_id, "feeder_area")
                self._tag_topology_area_members(feeder_area, feeder_ctx, feeder_id, area_by_mrid)

                for switch_area in feeder_area.get("SwitchAreas", []) or []:
                    switch_ctx = {
                        **feeder_ctx,
                        **self._topology_area_context(switch_area, feeder_id, "switch_area"),
                    }
                    self._tag_topology_area_members(switch_area, switch_ctx, feeder_id, area_by_mrid)

                    for secondary_area in switch_area.get("SecondaryAreas", []) or []:
                        secondary_ctx = {
                            **switch_ctx,
                            **self._topology_area_context(
                                secondary_area, feeder_id, "secondary_area"
                            ),
                        }
                        self._tag_topology_area_members(
                            secondary_area, secondary_ctx, feeder_id, area_by_mrid
                        )

        return area_by_mrid

    def _topology_area_context(self, area: dict, feeder_id: str, level: str) -> dict:
        """Build the {<level>_id, <level>_name} pair for one topology-area dict."""
        area_id = area.get("@id")
        if not area_id:
            return {}
        return {
            f"{level}_id": area_id,
            f"{level}_name": self._resolve_area_name(feeder_id, area_id),
        }

    def _tag_topology_area_members(
        self, area: dict, context: dict, feeder_id: str, area_by_mrid: dict
    ) -> None:
        """Stamp the ancestry context onto every mRID a topology-area dict reaches."""
        mrids: set = set()

        # Equipment: tag the equipment's own mRID (edges / equipment-nodes) and the
        # connectivity nodes on its terminals.
        for key in ("AddressableEquipment", "UnaddressableEquipment"):
            for entry in area.get(key, []) or []:
                equipment = self.FEEDERS[feeder_id].get_object(entry.get("@id"))
                if equipment is None:
                    continue
                mrids.add(equipment.mRID)
                for terminal in getattr(equipment, "Terminals", None) or []:
                    cn = terminal.ConnectivityNode
                    if cn is not None:
                        mrids.add(cn.mRID)

        # BoundaryTerminals -> ConnectivityNode
        for entry in area.get("BoundaryTerminals", []) or []:
            terminal = self.FEEDERS[feeder_id].get_object(entry.get("@id"))
            if terminal is None:
                continue
            cn = getattr(terminal, "ConnectivityNode", None)
            if cn is not None:
                mrids.add(cn.mRID)

        for mrid in mrids:
            area_by_mrid.setdefault(mrid, {}).update(context)

    def _build_measurement_map(self, feeder_id: str) -> dict:
        """
        Build a lookup from measurement MRID -> conducting equipment info.

        GridAPPS-D simulation output keys measurements by measurement MRID,
        but we need to know which CIM equipment object each measurement
        belongs to (and its type) so we can update the visualization.

        For switches, Discrete measurements with measurementType="Pos"
        carry the open/closed state (value 0=open, 1=closed).
        For lines/transformers, Analog measurements carry magnitude/angle.
        """
        
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
                elif measurement.PowerSystemResource:
                    psr = measurement.PowerSystemResource
                    entry["conducting_equipment_mrid"] = str(psr.mRID) if psr.mRID else ""
                    entry["conducting_equipment_name"] = psr.name if psr.name else ""
                    entry["conducting_equipment_type"] = psr.__class__.__name__

                self.active_measurement_map[measurement_class][measurement.mRID] = entry


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

        # Use GraphModel's get_object method if available
        if hasattr(self.FEEDERS[feeder_id], "get_object"):
            obj = self.FEEDERS[feeder_id].get_object(uuid)
            if obj:
                detail = self._object_to_detail(obj)
                return {"uuid": uuid, "object": detail}
            else:
                return {"error": f"Object {uuid} not found"}  # 404
        else:
            # Manual search through all objects
            for _, instances in self.FEEDERS[feeder_id].graph.items():
                for obj in instances.values():
                    obj_id = str(getattr(obj, "identifier", getattr(obj, "mRID", "")))
                    if obj_id == uuid:
                        detail = self._object_to_detail(obj)
                        return {"uuid": uuid, "object": detail}

            return {"error": f"Object {uuid} not found"}  # 404

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

    def get_multi_coordinate(self, coords: list):
        if len(coords) == 0:
            return None

        if len(coords) <= 2:
            return max(coords)

        counts = {}
        for item in coords:
            counts[item] = counts.get(item, 0) + 1
        for item, count in counts.items():
            if count >= 2:
                return item

    def find_shared_coordinates(self, cim_obj) -> dict:
        multi_location_x = []
        multi_location_y = []

        # Process all positions from all terminals
        for terminal in cim_obj.Terminals:
            equipment = terminal.ConductingEquipment
            if equipment.Location is not None:
                location = equipment.Location
                for point in location.PositionPoints:
                    x = point.xPosition
                    y = point.yPosition
                    if x is not None and y is not None:
                        multi_location_x.append(x)
                        multi_location_y.append(y)

        coords = {
            "x": self.get_multi_coordinate(multi_location_x),
            "y": self.get_multi_coordinate(multi_location_y),
        }

        return coords

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
            "RegulatingControl"
            "GeneratingUnit"
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
        # Try to use cimgraph.utils method
        obj = self.FEEDERS[feeder_id].get_object(uuid)

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

        if hasattr(self.FEEDERS[feeder_id], "get_object"):
            obj = self.FEEDERS[feeder_id].get_object(uuid)
        else:
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

        # Delete the object
        if hasattr(self.FEEDERS[feeder_id], "delete"):
            self.FEEDERS[feeder_id].delete(obj)
            return True
        elif obj_class and obj_key:
            del self.FEEDERS[feeder_id].graph[obj_class][obj_key]
            return True

        return False
