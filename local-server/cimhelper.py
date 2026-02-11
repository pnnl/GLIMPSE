import os
import json

from uuid import UUID
from dataclasses import fields, is_dataclass

from cimbuilder.object_builder import new_energy_consumer
from cimbuilder.object_builder import new_synchronous_generator
from cimbuilder.object_builder import new_two_terminal_object

# CIM-graph imports
from cimgraph.models import FeederModel
import cimgraph.utils as cim_utils
from cimgraph.databases import XMLFile
import cimgraph.data_profile.cimhub_2023 as cim
# import cimgraph.data_profile.cim18gmdm.canonical as cim # must match env var
from cimbuilder.object_builder import new_synchronous_generator, new_two_terminal_object
from cimbuilder.object_builder.new_energy_consumer import new_energy_consumer

# Environment setup
os.environ["CIMG_CIM_PROFILE"] = "cimhub_2023"
os.environ["CIMG_IEC61970_301"] = "8"

# Current CIM network model - this holds the main graph data

class CIMHelper:
   def __init__(self) -> None:
      pass

   def cim_to_glimpse_structure(self, cim_filepath: str) -> str:
      """
      Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
      """
      
      # For multi-feeder CIM file reading
      print(f"Reading CIM file from {cim_filepath} with multi-feeder support...")
      # from readmultifeeder import read_feeder_cim
      # self._CIM_NETWORK = read_feeder_cim(cim_filepath)

      # For regular CIM file reading without multi-feeder support
      cim_file = XMLFile(cim_filepath)
      self._CIM_NETWORK: FeederModel = FeederModel(container=cim.Feeder(), connection=cim_file)

      phantom_node_count: int = 0
      objects: list = []

      for node in self._CIM_NETWORK.graph[cim.ConnectivityNode].values():
         coordinates = self.find_shared_coordinates(node)

         c_node = {
            "objectType": "c_node",
            "elementType": "node",
            "attributes": {
               "id": node.mRID,
               "name": node.name,
            }
         }

         if "dso_9500" in node.ConnectivityNodeContainer.name:
            c_node["attributes"]["feeder"] = node.ConnectivityNodeContainer.name
         
         if coordinates["x"] and coordinates["y"]:
            c_node["attributes"]["x"] = coordinates["x"]
            c_node["attributes"]["y"] = coordinates["y"]

         self._add_attributes(node, c_node)
         objects.append(c_node)

      self._CIM_NETWORK.get_all_edges(cim.ACLineSegment)
      for line in self._CIM_NETWORK.graph[cim.ACLineSegment].values():
         new_l = {
            "objectType": "overhead_line",
            "elementType": "edge",
            "attributes": {
               "id": line.mRID,
               "from": line.Terminals[0].ConnectivityNode.mRID,
               "to": line.Terminals[1].ConnectivityNode.mRID,
               "class_type": line.__class__.__name__,
               "length": line.length
            }
         }

         self._add_attributes(line, new_l)
         objects.append(new_l)

      self._CIM_NETWORK.get_all_edges(cim.PowerTransformer)
      self._CIM_NETWORK.get_all_edges(cim.PowerTransformerEnd)
      self._CIM_NETWORK.get_all_edges(cim.TransformerTank)
      self._CIM_NETWORK.get_all_edges(cim.TransformerTankEnd)

      for line in self._CIM_NETWORK.graph[cim.TransformerTank].values():

         new_edge = {
            "objectType": "transformer",
            "elementType": "edge",
            "attributes": {
               "id": line.mRID,
               "from": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID,
               "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID,
               "class_type": line.__class__.__name__
            }
         }

         self._add_attributes(line, new_edge)
         objects.append(new_edge)

      for line in self._CIM_NETWORK.graph[cim.PowerTransformer].values():
         if line.PowerTransformerEnd:
            if (len(line.PowerTransformerEnd) > 2):
               """
               T1 <- * -> T2
                     |
                     V
                     T3

               * : phantom node
               """
               phantom_node_id = f"phantom_node_id_{phantom_node_count}"

               objects.append({
                  "objectType": "phantom_node",
                  "elementType": "node",
                  "attributes": {
                     "id": phantom_node_id,
                     "v": "1kV"
                  }
               })

               edge_ID = f"{line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID}_{phantom_node_id}"
               objects.append({
                  "objectType": "transformer",
                  "elementType": "edge",
                  "attributes": {
                     "id": edge_ID,
                     "from": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID,
                     "to": phantom_node_id
                  }
               })

               edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID}"
               objects.append({
                  "objectType": "transformer",
                  "elementType": "edge",
                  "attributes": {
                     "id": edge_ID,
                     "from": phantom_node_id,
                     "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID
                  }
               })

               edge_ID = f"{phantom_node_id}_{line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID}"
               objects.append({
                  "objectType": "transformer",
                  "elementType": "edge",
                  "attributes": {
                     "id": edge_ID,
                     "from": phantom_node_id,
                     "to": line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID
                  }
               })

               phantom_node_count += 1
            else:
               new_edge = {
                  "objectType": "transformer",
                  "elementType": "edge",
                  "attributes": {
                     "id": line.mRID,
                     "from": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID,
                     "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID,
                     "class_type": line.__class__.__name__
                  }
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
         cim.Recloser
      ]
      
      for cim_type in cim_switch_types:
         if cim_type in self._CIM_NETWORK.graph:
            for line in self._CIM_NETWORK.graph[cim_type].values():
               new_edge = {
                  "objectType": "switch",
                  "elementType": "edge",
                  "attributes": {
                     "id": line.mRID,
                     "from": line.Terminals[0].ConnectivityNode.mRID,
                     "to": line.Terminals[1].ConnectivityNode.mRID,
                     "class_type": line.__class__.__name__
                  }
               }

               self._add_attributes(line, new_edge)
               objects.append(new_edge)
      
      for battery in self._CIM_NETWORK.graph[cim.BatteryUnit].values():
         new_battery = {
            "objectType": "battery",
            "elementType": "node",
            "attributes": {
               "id": battery.mRID,
               "name": battery.name,
               "class_type": battery.__class__.__name__
            }
         }
         self._add_attributes(battery, new_battery)
         objects.append(new_battery)
         
         new_line = {
            "objectType": "line",
            "elementType": "edge",
            "attributes": {
               "id": f"{battery.PowerElectronicsConnection.Terminals[0].ConnectivityNode.mRID}-{battery.mRID}",
               "from": battery.PowerElectronicsConnection.Terminals[0].ConnectivityNode.mRID,
               "to": battery.mRID 
            }
         }
         objects.append(new_line)

      return json.dumps({cim_filepath: {"objects": objects}})
   
   def _object_to_detail(self, obj):
      if not obj:
         return {}

      detail = {
         'identifier': str(getattr(obj, 'identifier', getattr(obj, 'mRID', 'unknown'))),
         'class_name': obj.__class__.__name__,
         'display_name': getattr(obj, 'name', str(getattr(obj, 'identifier', 'unnamed'))),
         'attributes': {},
         'associations': {}
      }

      # Get all dataclass fields if this is a dataclass
      if is_dataclass(obj):
         for field in fields(obj):
            value = getattr(obj, field.name, None)
            if value is not None:
               if field.metadata.get('type') == 'Association':
                  # This is a relationship to another object
                  if hasattr(value, 'identifier'):
                     detail['associations'][field.name] = str(value.identifier)
                  else:
                     detail['associations'][field.name] = str(value)
               else:
                  # This is a simple attribute
                  detail['attributes'][field.name] = str(value)

      return detail
   
   def get_cim_object(self, uuid: str):
      if not self._CIM_NETWORK:
         return {'error': 'No active model available'} # 400

      # Use GraphModel's get_object method if available
      if hasattr(self._CIM_NETWORK, 'get_object'):
         obj = self._CIM_NETWORK.get_object(uuid)
         if obj:
            detail = self._object_to_detail(obj)
            return { 'uuid': uuid, 'object': detail }
         else:
            return {'error': f'Object {uuid} not found'} # 404
      else:
         # Manual search through all objects
         for _, instances in self._CIM_NETWORK.graph.items():
            for obj in instances.values():
               obj_id = str(getattr(obj, 'identifier', getattr(obj, 'mRID', '')))
               if obj_id == uuid:
                  detail = self._object_to_detail(obj)
                  return { 'uuid': uuid, 'object': detail }

         return {'error': f'Object {uuid} not found'} # 404
   
   def new_bus_location(self, network:FeederModel, node:cim.ConnectivityNode, xPosition:float, yPosition:float):
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

   def export_cim_coords(self, new_coords_obj: list, output_path: str) -> None:
      for obj in new_coords_obj:
         c_node = self._CIM_NETWORK.graph[cim.ConnectivityNode][UUID(obj["mRID"].upper())]
         print(f"Updating coordinates for node {c_node.name} ({c_node.mRID}) to x: {obj['x']}, y: {obj['y']}")
         self.new_bus_location(network=self._CIM_NETWORK, node=c_node, xPosition=obj["x"], yPosition=obj["y"])

      cim_utils.get_all_data(self._CIM_NETWORK)
      cim_utils.write_xml(self._CIM_NETWORK, output_path)

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

   def find_shared_coordinates(self, node) -> dict:
      multi_location_x = []
      multi_location_y = []

      # Process all positions from all terminals
      for terminal in node.Terminals:
         equipment = terminal.ConductingEquipment
         if equipment.Location is not None:
            location = equipment.Location

            for point in location.PositionPoints:
               x = point.xPosition
               multi_location_x.append(x)
               y = point.yPosition
               multi_location_y.append(y)

      return {
      "x": self.get_multi_coordinate(multi_location_x),
      "y": self.get_multi_coordinate(multi_location_y)
      }

   def _add_attributes(self, cim_obj, new_obj):
      dense_fields = [
         "ConnectivityNodeContainer",
         "Location",
         "PowerElectronicsConnection",
      ]
      for field in fields(cim_obj):
         if field.metadata["type"] == "Attribute": # association, aggregateof, and ofaggregate
            attribute = getattr(cim_obj, field.name)
            if field.name in dense_fields and attribute is not None:
               new_obj["attributes"][field.name] = str(attribute.name)
            else:
               new_obj["attributes"][field.name] = str(attribute)

   def export_cim(self, dir2save: str, filename: str, data: list) -> None:
      if len(data) == 0:
         print("No objects to export, creating copy of the original file")
         cim_utils.get_all_data(self._CIM_NETWORK)
         cim_utils.write_xml(self._CIM_NETWORK, dir2save + "\\cim_output.xml")
         return

      feeder = self._CIM_NETWORK.container

      # [0] = new nerminal with type
      # [1] = new connectivity node
      # [2] = existing connectivity node

      for nodeObj in data:
         # 1. get existing connectivity node
         existing_c_node = self._CIM_NETWORK.graph[cim.ConnectivityNode][UUID(nodeObj[2]["mRID"].upper())]

         # 2. create new connectivity node
         new_c_node = cim.ConnectivityNode(mRID=nodeObj[1]["mRID"].upper(), name=nodeObj[1]["name"])
         self._CIM_NETWORK.add_to_graph(new_c_node)

         # 3. connect both connectivity nodes with new_two_terminal_obj function
         new_two_terminal_object(network=self._CIM_NETWORK, container=feeder, class_type=cim.ACLineSegment, name=existing_c_node.mRID.split("-")[0], node1=existing_c_node, node2=new_c_node)

         # 4. Finally create the new synchronous generator or energy consumer by connecting to new connectivity node
         if nodeObj[0]["type"] == "diesel_dg":
            new_synchronous_generator(network=self._CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
         elif nodeObj[0]["type"] == "load":
            new_energy_consumer(network=self._CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
         elif nodeObj[0]["type"] == "inverter_dyn":
            # new power electronics connection
            pass
         elif nodeObj[0]["type"] == "capacitor":
            # new one terminal object
            pass

      out_dir = os.path.join(dir2save, os.path.splitext(os.path.basename(filename))[0] + "_out.xml")
      cim_utils.get_all_data(self._CIM_NETWORK)
      cim_utils.write_xml(self._CIM_NETWORK, out_dir)
      
   def get_mermaid(self, uuid: str) -> str:
      # Try to use cimgraph.utils method
      obj = self._CIM_NETWORK.get_object(uuid)
      
      try:
         mermaid_diagram = cim_utils.get_mermaid(obj)
         print(mermaid_diagram)
         return json.dumps({
               'uuid': uuid,
               'mermaid': mermaid_diagram
         })
      except (ImportError, AttributeError):
         # Fallback: create simple mermaid diagram
         mermaid = f"graph TD\n    {uuid}[{obj.__class__.__name__}]\n"
         return json.dumps({
               'uuid': uuid,
               'mermaid': mermaid
         })

   def delete_cim_object(self, uuid: str) -> bool: 
      if not self._CIM_NETWORK:
         return False

      # Get the object first
      obj = None
      obj_class = None
      obj_key = None

      if hasattr(self._CIM_NETWORK, 'get_object'):
         obj = self._CIM_NETWORK.get_object(uuid)
      else:
         # Manual search
         for cim_class, instances in self._CIM_NETWORK.graph.items():
               for key, instance in instances.items():
                  obj_id = str(getattr(instance, 'identifier', getattr(instance, 'mRID', '')))
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
      if hasattr(self._CIM_NETWORK, 'delete'):
         self._CIM_NETWORK.delete(obj)
         return True
      elif obj_class and obj_key:
         del self._CIM_NETWORK.graph[obj_class][obj_key]
         return True
      
      return False