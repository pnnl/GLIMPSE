from flask import Flask, request as req
from flask_cors import CORS
from flask_socketio import SocketIO
import networkx as nx
from uuid import UUID
import glm
import json
import os

from cimbuilder.object_builder import new_energy_consumer
from cimbuilder.object_builder import new_synchronous_generator
from cimbuilder.object_builder import new_two_terminal_object

#cim-graph imports
from cimgraph.models import FeederModel
from cimgraph.databases import XMLFile
from dataclasses import fields
import cimgraph.utils as cim_utils
import cimgraph.data_profile.cimhub_2023 as cim
os.environ["CIMG_CIM_PROFILE"] = "cimhub_2023"
os.environ["CIMG_IEC61970_301"] = "8"

# CIM-G Globals and constants
NX_GRAPH = nx.MultiGraph()
CIM_NETWORK = None
LOAD_TYPES = ["EnergyConsumer", "ConformLoad", "NonConformLoad"]
GEN_TYPES = ["RotatingMachine", "SynchronousMachine", "AsynchronousMachine", "EnergySource"]
CAP_TYPES = ["ShuntCompensator", "LinearShuntCompensator"]
INV_TYPES = ["PowerElectronicsConnection"]
TRANS_TYPES = ["PowerTransformer"]
SWITCH_TYPES = ["LoadBreakSwitch"]

def glm_to_dict( file_paths: list ) -> dict:
   glm_dicts = {}
   for glm_path in file_paths:
      glm_dicts[ os.path.basename(glm_path).split(".")[0] + ".json" ] = glm.load(glm_path)

   return glm_dicts

def dict2json( glm_dict: dict ) -> str:
   glm_json = json.dumps( glm_dict, indent= 3 )
   return glm_json

def create_graph(data: dict, set_communities: bool=False) -> dict:
   global NX_GRAPH
   NX_GRAPH.clear()

   community_ids = {}

   for obj in data["objects"]:
      if obj["elementType"] == "node":
         if "id" in obj["attributes"]:
            node_id = obj["attributes"]["id"]
         elif "name" in obj["attributes"]:
            node_id = obj["attributes"]["name"]

         NX_GRAPH.add_node(node_id)
      elif obj["elementType"] == "edge":
         if "id" in obj["attributes"]:
            edge_id = obj["attributes"]["id"]
         elif "name" in obj["attributes"]:
            edge_id = obj["attributes"]["name"]

         NX_GRAPH.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], edge_id)

   if set_communities :
      # favor smaller communities and stop at 151 communities
      # partition = nx.algorithms.community.greedy_modularity_communities(G=NX_GRAPH, resolution=1.42)
      partition = nx.algorithms.community.louvain_communities(G=NX_GRAPH, resolution=1.2, threshold=1.e-6, max_level=5)

      # print(f"Number of communities: {len(partition)}")

      for community_id, community in enumerate(partition):
         for node in community:
            community_ids[node] = f"CID_{community_id}"

      nx.set_node_attributes(NX_GRAPH, community_ids, "glimpse_community_id")
      return nx.get_node_attributes(G=NX_GRAPH, name="glimpse_community_id")

def get_modularity() -> float:
   modularity = nx.algorithms.community.modularity(NX_GRAPH, nx.community.label_propagation_communities(NX_GRAPH))
   return modularity

def get_multi_coordinate(coords: list):
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

def find_shared_coordinates(node):
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
     "x": get_multi_coordinate(multi_location_x),
     "y": get_multi_coordinate(multi_location_y)
   }

def add_attributes(cim_obj, new_obj):
   for field in fields(cim_obj):
      if field.metadata["type"] == "Attribute":
         new_obj["attributes"][field.name] = str(getattr(cim_obj, field.name))

def cim2GS(cim_filepath: str) -> str:
   """
   Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
   """
   global CIM_NETWORK
   phantom_node_count = 0
   cim_file = XMLFile(cim_filepath)
   CIM_NETWORK = FeederModel(container=cim.Feeder(), connection=cim_file)
   objects = []

   for node in CIM_NETWORK.graph[cim.ConnectivityNode].values():
      coordinates = find_shared_coordinates(node)

      c_node = {
         "objectType": "c_node",
         "elementType": "node",
         "attributes": {
            "id": node.mRID,
            "name": node.name,
         }
      }

      if coordinates["x"] and coordinates["y"]:
         c_node["attributes"]["x"] = coordinates["x"]
         c_node["attributes"]["y"] = coordinates["y"]

      add_attributes(node, c_node)
      objects.append(c_node)

      for terminal in node.Terminals:
         equipment = terminal.ConductingEquipment
         eq_class_type = equipment.__class__.__name__

         if eq_class_type in LOAD_TYPES:
            new_load = {
               "objectType": "load",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_load)

            objects.append(new_load)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in GEN_TYPES:
            new_gen = {
               "objectType": "diesel_dg",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_gen)

            objects.append(new_gen)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in CAP_TYPES:
            new_cap = {
               "objectType": "capacitor",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type
               }
            }
            add_attributes(terminal, new_cap)

            objects.append(new_cap)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

         if eq_class_type in INV_TYPES:
            new_inv = {
               "objectType": "inverter_dyn",
               "elementType": "node",
               "attributes": {
                  "id": terminal.mRID,
                  "name": terminal.name,
                  "sequenceNumber": terminal.sequenceNumber,
                  "eq_class_type": eq_class_type,
               }
            }
            add_attributes(terminal, new_inv)

            objects.append(new_inv)
            objects.append({
               "objectType": "line",
               "elementType": "edge",
               "attributes": {
                  "id": f"{node.mRID}_{terminal.mRID}",
                  "from": node.mRID,
                  "to": terminal.mRID
               }
            })

   CIM_NETWORK.get_all_edges(cim.ACLineSegment)
   for line in CIM_NETWORK.graph[cim.ACLineSegment].values():
      new_l = {
         "objectType": "overhead_line",
         "elementType": "edge",
         "attributes": {
            "id": line.mRID,
            "from": line.Terminals[0].ConnectivityNode.mRID,
            "to": line.Terminals[1].ConnectivityNode.mRID,
            "length": line.length,
         }
      }

      add_attributes(line, new_l)
      objects.append(new_l)

   CIM_NETWORK.get_all_edges(cim.PowerTransformer)
   CIM_NETWORK.get_all_edges(cim.PowerTransformerEnd)
   CIM_NETWORK.get_all_edges(cim.TransformerTank)
   CIM_NETWORK.get_all_edges(cim.TransformerTankEnd)

   for line in CIM_NETWORK.graph[cim.TransformerTank].values():

      new_edge = {
         "objectType": "transformer",
         "elementType": "edge",
         "attributes": {
            "id": line.mRID,
            "from": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID,
            "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID
         }
      }

      add_attributes(line, new_edge)
      objects.append(new_edge)

   for line in CIM_NETWORK.graph[cim.PowerTransformer].values():
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
                  "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID
               }
            }

            add_attributes(line, new_edge)
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
      if cim_type in CIM_NETWORK.graph:
         for line in CIM_NETWORK.graph[cim_type].values():
            new_edge = {
               "objectType": "switch",
               "elementType": "edge",
               "attributes": {
                  "id": line.mRID,
                  "from": line.Terminals[0].ConnectivityNode.mRID,
                  "to": line.Terminals[1].ConnectivityNode.mRID,
               }
            }

            add_attributes(line, new_edge)
            objects.append(new_edge)

   return json.dumps({cim_filepath: {"objects": objects}})

def new_bus_location(network:FeederModel, node:cim.ConnectivityNode, xPosition:float, yPosition:float):
   #  new_locations = []
    # coord_sys = network.first(cim.CoordinateSystem)
    for terminal in node.Terminals:
        equipment = terminal.ConductingEquipment
        location = equipment.Location
        if location is None:
            location = cim.Location(name=equipment.name+'_location')
            equipment.Location = location
            location.PowerSystemResources.append(equipment)
            network.add_to_graph(location)
            # TODO location.CoordinateSystem = coord_sys

        point = cim.PositionPoint()
        point.sequenceNumber = terminal.sequenceNumber
        point.xPosition = xPosition
        point.yPosition = yPosition
        point.Location = location
        location.PositionPoints.append(point)
        network.add_to_graph(point)

      #   new_locations.append(location)
   #  return new_locations

def export_cim_coords(new_coords_obj: list, output_path: str):
   global CIM_NETWORK

   for obj in new_coords_obj:
      c_node = CIM_NETWORK.graph[cim.ConnectivityNode][UUID(obj["mRID"].upper())]
      print(f"Updating coordinates for node {c_node.name} ({c_node.mRID}) to x: {obj['x']}, y: {obj['y']}")
      new_bus_location(network=CIM_NETWORK, node=c_node, xPosition=obj["x"], yPosition=obj["y"])

   cim_utils.get_all_data(CIM_NETWORK)
   cim_utils.write_xml(CIM_NETWORK, output_path)

def exportCIM(dir2save: str, filename: str, data: list):
   global CIM_NETWORK

   if len(data) == 0:
      print("No objects to export, creating copy of the original file")
      cim_utils.get_all_data(CIM_NETWORK)
      cim_utils.write_xml(CIM_NETWORK, dir2save + "\\cim_output.xml")
      return

   feeder = CIM_NETWORK.container

   # [0] = new nerminal with type
   # [1] = new connectivity node
   # [2] = existing connectivity node

   for nodeObj in data:
      # 1. get existing connectivity node
      existing_c_node = CIM_NETWORK.graph[cim.ConnectivityNode][UUID(nodeObj[2]["mRID"].upper())]

      # 2. create new connectivity node
      new_c_node = cim.ConnectivityNode(mRID=nodeObj[1]["mRID"].upper(), name=nodeObj[1]["name"])
      CIM_NETWORK.add_to_graph(new_c_node)

      # 3. connect both connectivity nodes with new_two_terminal_obj function
      new_two_terminal_object(network=CIM_NETWORK, container=feeder, class_type=cim.ACLineSegment, name=existing_c_node.mRID.split("-")[0], node1=existing_c_node, node2=new_c_node)

      # 4. Finally create the new synchronous generator or energy consumer by connecting to new connectivity node
      if nodeObj[0]["type"] == "diesel_dg":
         new_synchronous_generator(network=CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
      elif nodeObj[0]["type"] == "load":
         new_energy_consumer(network=CIM_NETWORK, container=feeder, name=nodeObj[0]["name"], node=new_c_node)
      elif nodeObj[0]["type"] == "inverter_dyn":
         # new power electronics connection
         pass
      elif nodeObj[0]["type"] == "capacitor":
         # new one terminal object
         pass


   cim_utils.get_all_data(CIM_NETWORK)
   cim_utils.write_xml(CIM_NETWORK, os.path.join(dir2save, os.path.splitext(os.path.basename(filename))[0] + "_out.xml"))

#------------------------------ Server ------------------------------#

app = Flask(__name__)
# socketio = SocketIO(app)
CORS(app, origins=["http://localhost:5173"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173"], async_mode="gevent")

#------------------------------ End Server ------------------------------#

#------------------------------ Server Routes ------------------------------#

@app.route("/")
def hello():
  return {"api": "GLIMPSE flask backend"}

@app.route("/glm2json", methods=["POST"])
def glm_to_json():
  """
  This endpoint gets the paths of the uploaded glm files to be converted to JSON
  """
  paths = req.get_json()
  glm_dict = glm_to_dict(paths)

  return dict2json(glm_dict)

@app.route("/json2glm", methods=["POST"])
def json_to_glm():
  """
  converts json GLD model representation back to GLD model (.glm)
  """
  if (req.is_json):
    req_data = req.get_json()
    data = req_data["data"]
    save_dir = req_data["saveDir"]

    for filename in data.keys():
      with open(os.path.join(save_dir, filename), "w") as glm_file:
        glm.dump(data[filename], glm_file)
        glm_file.close()

  return "", 204

@app.route("/create-nx-graph", methods=["POST"])
def create_nx_graph():
   """
   This endpoint will create a networkx GRAPH object in this server. If the graph data is a list
   then most likely there is a true value where this end point needs to return a dict of community IDs
   """
   graphData = req.get_json()

   if isinstance(graphData, dict):
      create_graph(graphData)
      return "", 204
   elif isinstance(graphData, list):
      #index 0 contains the data and index 1 contains a bool value whether to set the community IDs as well
      community_ids = create_graph(data=graphData[0], set_communities=graphData[1])
      return community_ids

@app.route("/get-stats", methods=["GET"])
def get_stats():
   """
   This endpoint gathers some summary statistics using networkx and the already existing GRAPH object.
   """
   summary_stats = {
      "#Nodes": NX_GRAPH.number_of_nodes(),
      "#Edges": NX_GRAPH.number_of_edges(),
      "#ConnectedComponets": nx.number_connected_components(NX_GRAPH),
      "modularity": get_modularity(),
   }

   return summary_stats

@app.route("/cimg-to-GS", methods=["POST"])
def cim_to_glimpse():
  cim_filepath = req.get_json()
  GS_data = cim2GS(cim_filepath[0])

  return GS_data

@app.route("/export-cim", methods=["POST"])
def export_cim():
  cim_data = req.get_json()

  export_dir = cim_data["savepath"]
  print(export_dir)
  data = cim_data["objs"]
  og_filepath = cim_data["filename"]

  exportCIM(export_dir, og_filepath, data)
  return "", 204

@app.route("/export-cim-coordinates", methods=["POST"])
def export_cim_():
   """
   This endpoint exports the new coordinates of the nodes to the CIM file
   """
   cim_data = req.get_json()
   new_coords_obj = cim_data["data"]
   output_path = cim_data["filepath"]

   try:
      export_cim_coords(new_coords_obj, output_path)
   except Exception as e:
      print(f"Error exporting CIM coordinates: {e}")
      return {"error": str(e)}, 500
   return "", 204


#------------------------------ End Server Routes ------------------------------#

#------------------------------ WebSocket Events ------------------------------#
@socketio.on("glimpse")
def glimpse(data):
   socketio.emit("update-data", data)

@socketio.on("addNode")
def add_node(newNodeData):
   socketio.emit("add-node", newNodeData)

@socketio.on("addEdge")
def add_edge(newEdgeData):
   socketio.emit("add-edge", newEdgeData)

@socketio.on("deleteNode")
def delete_node(nodeID):
   socketio.emit("delete-node", nodeID)

@socketio.on("deleteEdge")
def delete_edge(edgeID):
   socketio.emit("delete-edge", edgeID)

#------------------------------ End WebSocket Events ------------------------------#

#-------------------------- Start WebSocket Server --------------------------#

if __name__ == "__main__":
   socketio.run(app, port=5051, debug=False, log_output=True)

#-------------------------- End Start WebSocket Server --------------------------#
