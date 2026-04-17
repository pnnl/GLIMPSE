import os
import json
import traceback

from threading import Lock
from concurrent.futures import ThreadPoolExecutor

from uuid import UUID
from dataclasses import fields, is_dataclass

from cimbuilder.object_builder import new_energy_consumer
from cimbuilder.object_builder import new_synchronous_generator
from cimbuilder.object_builder import new_two_terminal_object

# CIM-graph imports
# from cimgraph.databases.gridappsd import GridappsdConnection
from cimgraph.databases.blazegraph import BlazegraphConnection
from cimgraph.models import FeederModel
import cimgraph.utils as cim_utils
from cimgraph.databases import XMLFile
import cimgraph.data_profile.cimhub_2023 as cim
from cimbuilder.object_builder import new_synchronous_generator, new_two_terminal_object
from cimbuilder.object_builder.new_energy_consumer import new_energy_consumer

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
        pass

    def _get_cim_feeder(self, model_id: str):
        database = BlazegraphConnection()
        # database = GridappsdConnection()
        feeder = cim.Feeder(mRID=model_id)
        feeder_model = FeederModel(connection=database, container=feeder)
        return feeder_model

    # gjs: GLIMPSE JSON Structure
    def cim_to_gjs(
        self, model_IDs: list[str] | None = None, filepaths: list[str] | None = None
    ):
        if model_IDs is not None:
            gjs = {id: {"objects": [], "measurement_map": {}} for id in model_IDs}

            for id in model_IDs:
                result = self._parse_model(model_id=id)
                if isinstance(result, dict) and "error" in result:
                    gjs[id]["objects"] = result
                else:
                    gjs[id]["objects"], gjs[id]["measurement_map"] = result

            return gjs

        if filepaths is not None:
            gjs = {
                os.path.basename(path): {"objects": [], "measurement_map": {}}
                for path in filepaths
            }

            for path in filepaths:
                filename = os.path.basename(path)
                result = self._parse_model(filepath=path)
                if isinstance(result, dict) and "error" in result:
                    gjs[filename]["objects"] = result
                else:
                    gjs[filename]["objects"], gjs[filename]["measurement_map"] = result

            return gjs

    def _parse_model(self, model_id: str | None = None, filepath: str | None = None):
        """
        Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
        """
        self._FEEDERS: dict[str, FeederModel] = {}
        feeder_id = None

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

        if model_id is not None:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._get_cim_feeder, model_id=model_id)
            try:
                self._FEEDERS[model_id] = future.result(timeout=60)
                feeder_id = model_id
                # cim_utils.get_all_bus_data(self._FEEDERS[feeder_id])
                self._FEEDERS[feeder_id].get_all_edges(cim.ConnectivityNode)
                self._FEEDERS[feeder_id].get_all_edges(cim.Terminal)

                # cim_utils.get_all_line_data(self._FEEDERS[feeder_id])
                self._FEEDERS[feeder_id].get_all_edges(cim.ACLineSegment)

                # cim_utils.get_all_transformer_data(self._FEEDERS[feeder_id])
                self._FEEDERS[feeder_id].get_all_edges(cim.TransformerTank)
                self._FEEDERS[feeder_id].get_all_edges(cim.PowerTransformer)
                self._FEEDERS[feeder_id].get_all_edges(cim.TransformerTankEnd)
                self._FEEDERS[feeder_id].get_all_edges(cim.PowerTransformerEnd)

                # cim_utils.get_all_load_data(self._FEEDERS[feeder_id])
                self._FEEDERS[feeder_id].get_all_edges(cim.EnergyConsumer)
                self._FEEDERS[feeder_id].get_all_edges(cim.ConformLoad)
                self._FEEDERS[feeder_id].get_all_edges(cim.NonConformLoad)

                self._FEEDERS[feeder_id].get_all_edges(cim.RotatingMachine)
                self._FEEDERS[feeder_id].get_all_edges(cim.SynchronousMachine)
                self._FEEDERS[feeder_id].get_all_edges(cim.AsynchronousMachine)
                self._FEEDERS[feeder_id].get_all_edges(cim.EnergySource)

                self._FEEDERS[feeder_id].get_all_edges(cim.ShuntCompensator)
                self._FEEDERS[feeder_id].get_all_edges(cim.LinearShuntCompensator)
                self._FEEDERS[feeder_id].get_all_edges(cim.SeriesCompensator)

                # cim_utils.get_all_inverter_data(self._FEEDERS[feeder_id])
                self._FEEDERS[feeder_id].get_all_edges(cim.PowerElectronicsConnection)
                self._FEEDERS[feeder_id].get_all_edges(cim.BatteryUnit)

                # Switch types
                self._FEEDERS[feeder_id].get_all_edges(cim.Breaker)
                self._FEEDERS[feeder_id].get_all_edges(cim.Fuse)
                self._FEEDERS[feeder_id].get_all_edges(cim.Switch)
                self._FEEDERS[feeder_id].get_all_edges(cim.Sectionaliser)
                self._FEEDERS[feeder_id].get_all_edges(cim.LoadBreakSwitch)
                self._FEEDERS[feeder_id].get_all_edges(cim.Disconnector)
                self._FEEDERS[feeder_id].get_all_edges(cim.Recloser)

                # Measurements (needed to map simulation output to equipment)
                self._FEEDERS[feeder_id].get_all_edges(cim.Analog)
                self._FEEDERS[feeder_id].get_all_edges(cim.Discrete)
                self._FEEDERS[feeder_id].get_all_edges(cim.Measurement)

                # cim_utils.get_all_limit_data(self._FEEDERS[feeder_id])
                cim_utils.get_all_location_data(self._FEEDERS[feeder_id])
            except Exception as e:
                tb = traceback.format_exc()
                print(tb)
                return {"error": "Database connection timeout", "traceback": tb}
        elif filepath is not None:
            # For regular CIM file reading without multi-feeder support
            cim_file = XMLFile(filepath)
            filename = os.path.basename(filepath)
            self._FEEDERS[filename] = FeederModel(
                container=cim.Feeder(), connection=cim_file
            )
            feeder_id = filename

        phantom_node_count: int = 0
        objects: list = []

        for node in self._FEEDERS[feeder_id].graph[cim.ConnectivityNode].values():
            new_node = {
                "objectType": "connectivity_node",
                "elementType": "node",
                "attributes": {
                    "id": node.mRID,
                    "name": node.name if node.name else "",
                    # "feeder": feeder_id,
                },
            }
            coordinates = self.find_shared_coordinates(node)

            if (
                node.ConnectivityNodeContainer and node.ConnectivityNodeContainer.name
            ) and "dso_9500" in node.ConnectivityNodeContainer.name:
                new_node["attributes"]["feeder"] = node.ConnectivityNodeContainer.name

            if coordinates["x"] and coordinates["y"]:
                new_node["attributes"]["x"] = coordinates["x"]
                new_node["attributes"]["y"] = coordinates["y"]

            for terminal in node.Terminals:
                equipment = terminal.ConductingEquipment
                if equipment is not None:
                    eq_class_type = equipment.__class__.__name__

                    if eq_class_type in TYPES:
                        new_obj = {
                            "objectType": TYPES[eq_class_type],
                            "elementType": "node",
                            "attributes": {
                                "id": terminal.mRID,
                                "name": terminal.name if terminal.name else "",
                                "sequenceNumber": terminal.sequenceNumber,
                                "eq_class_type": eq_class_type,
                                # "feeder_id": feeder_id
                            },
                        }
                        self._add_attributes(terminal, new_obj)
                        objects.append(new_obj)

                        # Connect the equipment node to the connectivity node with an edge
                        objects.append(
                            {
                                "objectType": "line",
                                "elementType": "edge",
                                "attributes": {
                                    "id": f"{node.mRID}_{terminal.mRID}",
                                    "from": node.mRID,
                                    "to": terminal.mRID,
                                    # "feeder_id": feeder_id
                                },
                            }
                        )

            self._add_attributes(node, new_node)
            objects.append(new_node)

        for line in self._FEEDERS[feeder_id].graph[cim.ACLineSegment].values():
            # conceptrive or insolated
            new_l = {
                "objectType": "overhead_line",
                "elementType": "edge",
                "attributes": {
                    "id": line.mRID,
                    "from": line.Terminals[0].ConnectivityNode.mRID,
                    "to": line.Terminals[1].ConnectivityNode.mRID,
                    "class_type": line.__class__.__name__,
                    "length": line.length,
                    # "feeder_id": feeder_id,
                },
            }

            self._add_attributes(line, new_l)
            objects.append(new_l)

        for line in self._FEEDERS[feeder_id].graph[cim.TransformerTank].values():
            new_edge = {
                "objectType": "transformer",
                "elementType": "edge",
                "attributes": {
                    "id": line.mRID,
                    "from": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID,
                    "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID,
                    "class_type": line.__class__.__name__,
                    # "feeder_id": feeder_id,
                },
            }

            self._add_attributes(line, new_edge)
            objects.append(new_edge)

        for line in self._FEEDERS[feeder_id].graph[cim.PowerTransformer].values():
            if line.PowerTransformerEnd:
                if len(line.PowerTransformerEnd) > 2:
                    """
                    T1 <- * -> T2
                          |
                          V
                          T3

                    * : phantom node
                    """
                    phantom_node_id = f"phantom_node_id_{phantom_node_count}"

                    objects.append(
                        {
                            "objectType": "phantom_node",
                            "elementType": "node",
                            "attributes": {"id": phantom_node_id, "v": "1kV"},
                        }
                    )

                    edge_ID = f"{line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID}_{phantom_node_id}"
                    objects.append(
                        {
                            "objectType": "transformer",
                            "elementType": "edge",
                            "attributes": {
                                "id": edge_ID,
                                "from": line.PowerTransformerEnd[
                                    0
                                ].Terminal.ConnectivityNode.mRID,
                                "to": phantom_node_id,
                            },
                        }
                    )

                    edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID}"
                    objects.append(
                        {
                            "objectType": "transformer",
                            "elementType": "edge",
                            "attributes": {
                                "id": edge_ID,
                                "from": phantom_node_id,
                                "to": line.PowerTransformerEnd[
                                    1
                                ].Terminal.ConnectivityNode.mRID,
                            },
                        }
                    )

                    edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID}"
                    objects.append(
                        {
                            "objectType": "transformer",
                            "elementType": "edge",
                            "attributes": {
                                "id": edge_ID,
                                "from": phantom_node_id,
                                "to": line.PowerTransformerEnd[
                                    2
                                ].Terminal.ConnectivityNode.mRID,
                            },
                        }
                    )

                    phantom_node_count += 1
                else:
                    new_edge = {
                        "objectType": "transformer",
                        "elementType": "edge",
                        "attributes": {
                            "id": line.mRID,
                            "from": line.PowerTransformerEnd[
                                0
                            ].Terminal.ConnectivityNode.mRID,
                            "to": line.PowerTransformerEnd[
                                1
                            ].Terminal.ConnectivityNode.mRID,
                            "class_type": line.__class__.__name__,
                            "feeder_id": feeder_id,
                        },
                    }

                    self._add_attributes(line, new_edge)
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
            if cim_type in self._FEEDERS[feeder_id].graph:
                for switch_obj in self._FEEDERS[feeder_id].graph[cim_type].values():
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
                            "from": switch_obj.Terminals[0].ConnectivityNode.mRID,
                            "to": switch_obj.Terminals[1].ConnectivityNode.mRID,
                            "class_type": switch_obj.__class__.__name__,
                            "normalOpen": normal_open,
                            "open": switch_status,
                            "ratedCurrent": rated_current,
                            "measurement_mrids": measurement_mrids,
                        },
                    }

                    if (
                        hasattr(switch_obj, "breakingCapacity")
                        and switch_obj.breakingCapacity is not None
                    ):
                        new_edge["attributes"]["breakingCapacity"] = str(
                            switch_obj.breakingCapacity
                        )

                    self._add_attributes(switch_obj, new_edge)
                    objects.append(new_edge)

        # for battery in self._FEEDERS[feeder_id].graph[cim.BatteryUnit].values():
        #    new_battery = {
        #       "objectType": "battery",
        #       "elementType": "node",
        #       "attributes": {
        #          "id": battery.mRID,
        #          "name": battery.name,
        #          "class_type": battery.__class__.__name__,
        #          "feeder_id": feeder_id
        #       }
        #    }
        #    self._add_attributes(battery, new_battery)
        #    objects.append(new_battery)

        #    new_line = {
        #       "objectType": "line",
        #       "elementType": "edge",
        #       "attributes": {
        #          "id": f"{battery.PowerElectronicsConnection.Terminals[0].ConnectivityNode.mRID}-{battery.mRID}",
        #          "from": battery.PowerElectronicsConnection.Terminals[0].ConnectivityNode.mRID,
        #          "to": battery.mRID,
        #       }
        #    }
        #    objects.append(new_line)

        # Build measurement map: measurement MRID -> equipment info
        # This is used to map simulation output measurements to CIM objects
        measurement_map = self._build_measurement_map(feeder_id)

        return objects, measurement_map

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
        measurement_map = {}

        measurement_types = [cim.Analog, cim.Discrete, cim.Measurement]
        for meas_type in measurement_types:
            if meas_type not in self._FEEDERS[feeder_id].graph:
                continue
            for meas in self._FEEDERS[feeder_id].graph[meas_type].values():
                meas_mrid = str(meas.mRID) if meas.mRID else None
                if not meas_mrid:
                    continue

                entry = {
                    "measurement_mrid": meas_mrid,
                    "name": meas.name if meas.name else "",
                    "measurement_type": (
                        meas.measurementType if meas.measurementType else ""
                    ),
                    "phases": str(meas.phases) if meas.phases else "",
                    "cim_class": meas.__class__.__name__,
                }

                # Link to conducting equipment via Terminal
                if meas.Terminal and meas.Terminal.ConductingEquipment:
                    eq = meas.Terminal.ConductingEquipment
                    entry["conducting_equipment_mrid"] = str(eq.mRID) if eq.mRID else ""
                    entry["conducting_equipment_name"] = eq.name if eq.name else ""
                    entry["conducting_equipment_type"] = eq.__class__.__name__
                elif meas.PowerSystemResource:
                    psr = meas.PowerSystemResource
                    entry["conducting_equipment_mrid"] = (
                        str(psr.mRID) if psr.mRID else ""
                    )
                    entry["conducting_equipment_name"] = psr.name if psr.name else ""
                    entry["conducting_equipment_type"] = psr.__class__.__name__

                measurement_map[meas_mrid] = entry

        return measurement_map

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
        if not self._FEEDERS[feeder_id]:
            return {"error": "No active model available"}  # 400

        # Use GraphModel's get_object method if available
        if hasattr(self._FEEDERS[feeder_id], "get_object"):
            obj = self._FEEDERS[feeder_id].get_object(uuid)
            if obj:
                detail = self._object_to_detail(obj)
                return {"uuid": uuid, "object": detail}
            else:
                return {"error": f"Object {uuid} not found"}  # 404
        else:
            # Manual search through all objects
            for _, instances in self._FEEDERS[feeder_id].graph.items():
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
            c_node = self._FEEDERS[feeder_id].graph[cim.ConnectivityNode][
                UUID(obj["mRID"].upper())
            ]
            self.new_bus_location(
                network=self._FEEDERS[feeder_id],
                node=c_node,
                xPosition=obj["x"],
                yPosition=obj["y"],
            )

        cim_utils.get_all_data(self._FEEDERS[feeder_id])
        cim_utils.write_xml(self._FEEDERS[feeder_id], output_path)

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
        ]

        for field in fields(cim_obj):
            if field.name == "identifier":
                continue

            if (
                field.metadata["type"] == "Attribute"
            ):  # association, aggregateof, and ofaggregate
                attribute = getattr(cim_obj, field.name)
                if field.name in dense_fields and attribute is not None:
                    if isinstance(attribute, list):
                        new_obj["attributes"][field.name] = len(attribute)

                    new_obj["attributes"][field.name] = str(attribute.name)
                elif attribute is not None:
                    new_obj["attributes"][field.name] = str(attribute)

    def export_cim(
        self, feeder_id: str, dir2save: str, filename: str, data: list
    ) -> None:
        if len(data) == 0:
            cim_utils.get_all_data(self._FEEDERS[feeder_id])
            cim_utils.write_xml(self._FEEDERS[feeder_id], dir2save + "\\cim_output.xml")
            return

        feeder = self._FEEDERS[feeder_id].container

        # [0] = new nerminal with type
        # [1] = new connectivity node
        # [2] = existing connectivity node

        for nodeObj in data:
            # 1. get existing connectivity node
            existing_c_node = self._FEEDERS[feeder_id].graph[cim.ConnectivityNode][
                UUID(nodeObj[2]["mRID"].upper())
            ]

            # 2. create new connectivity node
            new_c_node = cim.ConnectivityNode(
                mRID=nodeObj[1]["mRID"].upper(), name=nodeObj[1]["name"]
            )
            self._FEEDERS[feeder_id].add_to_graph(new_c_node)

            # 3. connect both connectivity nodes with new_two_terminal_obj function
            new_two_terminal_object(
                network=self._FEEDERS[feeder_id],
                container=feeder,
                class_type=cim.ACLineSegment,
                name=existing_c_node.mRID.split("-")[0],
                node1=existing_c_node,
                node2=new_c_node,
            )

            # 4. Finally create the new synchronous generator or energy consumer by connecting to new connectivity node
            if nodeObj[0]["type"] == "diesel_dg":
                new_synchronous_generator(
                    network=self._FEEDERS[feeder_id],
                    container=feeder,
                    name=nodeObj[0]["name"],
                    node=new_c_node,
                )
            elif nodeObj[0]["type"] == "load":
                new_energy_consumer(
                    network=self._FEEDERS[feeder_id],
                    container=feeder,
                    name=nodeObj[0]["name"],
                    node=new_c_node,
                )
            elif nodeObj[0]["type"] == "inverter_dyn":
                # new power electronics connection
                pass
            elif nodeObj[0]["type"] == "capacitor":
                # new one terminal object
                pass

        out_dir = os.path.join(
            dir2save, os.path.splitext(os.path.basename(filename))[0] + "_out.xml"
        )
        cim_utils.get_all_data(self._FEEDERS[feeder_id])
        cim_utils.write_xml(self._FEEDERS[feeder_id], out_dir)

    def get_mermaid(self, feeder_id: str, uuid: str) -> str:
        # Try to use cimgraph.utils method
        obj = self._FEEDERS[feeder_id].get_object(uuid)

        try:
            mermaid_diagram = cim_utils.get_mermaid(obj)
            return json.dumps({"uuid": uuid, "mermaid": mermaid_diagram})
        except (ImportError, AttributeError):
            # Fallback: create simple mermaid diagram
            mermaid = f"graph TD\n    {uuid}[{obj.__class__.__name__}]\n"
            return json.dumps({"uuid": uuid, "mermaid": mermaid})

    def delete_cim_object(self, feeder_id: str, uuid: str) -> bool:
        if not self._FEEDERS[feeder_id]:
            return False

        # Get the object first
        obj = None
        obj_class = None
        obj_key = None

        if hasattr(self._FEEDERS[feeder_id], "get_object"):
            obj = self._FEEDERS[feeder_id].get_object(uuid)
        else:
            # Manual search
            for cim_class, instances in self._FEEDERS[feeder_id].graph.items():
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
        if hasattr(self._FEEDERS[feeder_id], "delete"):
            self._FEEDERS[feeder_id].delete(obj)
            return True
        elif obj_class and obj_key:
            del self._FEEDERS[feeder_id].graph[obj_class][obj_key]
            return True

        return False
