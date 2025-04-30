from flask import Flask, request as req
from flask_cors import CORS
from flask_socketio import SocketIO
import networkx as nx
import random as rand
from uuid import uuid4
import glm
import json
import os

#cim-graph imports
from cimgraph.models import FeederModel
from cimgraph.databases import XMLFile
import cimgraph.utils as cim_utils
os.environ["CIMG_CIM_PROFILE"] = "cimhub_2023"
import cimgraph.data_profile.cimhub_2023 as cim
os.environ["CIMG_IEC61970_301"] = "8"

# CIM-G Globals and constants
GRAPH = nx.MultiGraph()
CIM_NETWORK = None
LOAD_TYPES = ["EnergyConsumer", "ConformLoad", "NonConformLoad"]
GEN_TYPES = ["RotatingMachine", "SynchronousMachine", "AsynchronousMachine", "EnergySource"]
CAP_TYPES = ["ShuntCompensator", "LinearShuntCompensator"]
INV_TYPES = ["PowerElectronicsConnection"]
TRANS_TYPES = ["PowerTransformer"]
SWITCH_TYPES = ["LoadBreakSwitch"]

def addObject(objType: str, attributes: dict, elementType: str) -> None:
   print(f"Adding {objType} to GLIMPSE_OBJECT")
   GLIMPSE_OBJECT["objects"].append({
      "objectType": objType,
      "elementType": elementType,
      "attributes": attributes
   })

def glm_to_dict( file_paths: list ) -> dict:
   glm_dicts = {}
   for glm_path in file_paths:
      glm_dicts[ os.path.basename(glm_path).split(".")[0] + ".json" ] = glm.load(glm_path)

   return glm_dicts

def dict2json( glm_dict: dict ) -> str:
   glm_json = json.dumps( glm_dict, indent= 3 )
   return glm_json

def create_graph(data: dict, set_communities: bool=False) -> dict:
   GRAPH.clear()

   community_ids = {}
      
   for obj in data["objects"]:
      if obj["elementType"] == "node":
         GRAPH.add_node(obj["attributes"]["id"], objectType = obj["objectType"], attributes = obj["attributes"])
      else:
         GRAPH.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], obj["attributes"]["id"])

   if set_communities :
      # favor smaller communities and stop at 151 communities
      # partition = nx.algorithms.community.greedy_modularity_communities(G=GRAPH, resolution=1.42, best_n=151)
      partition = nx.algorithms.community.louvain_communities(G=GRAPH, resolution=1, max_level=5)

      # print(f"Number of communities: {len(partition)}")

      for community_id, community in enumerate(partition):
         for node in community:
            community_ids[node] = f"CID_{community_id}" 
      
      nx.set_node_attributes(GRAPH, community_ids, "glimpse_community_id")
      return nx.get_node_attributes(G=GRAPH, name="glimpse_community_id")

def get_modularity() -> float:
   modularity = nx.algorithms.community.modularity(GRAPH, nx.community.label_propagation_communities(GRAPH))
   return modularity

# long computation with larger graphs
def get_avg_betweenness_centrality() -> float:
   my_k = int(GRAPH.number_of_nodes()*0.68)
   betweenness_centrality_dict = nx.betweenness_centrality(GRAPH, k=my_k)
   
   centrality_sum = sum(betweenness_centrality_dict.values())
   avg = centrality_sum/len(betweenness_centrality_dict)

   return avg

# cim xml to GLIMPSE JSON Structure
def cim2GS(cim_filepath: str) -> str:
  """
  Converts CIM XML to GLIMPSE JSON Structure for GLIMPSE visualization
  """
  phantom_node_count = 0
  cim_file = XMLFile(cim_filepath)
  CIM_NETWORK = FeederModel(container=cim.Feeder(), connection=cim_file)
  objects = []
  
  for node in CIM_NETWORK.graph[cim.ConnectivityNode].values():
    objects.append({
        "objectType": "c_node",
        "elementType": "node",
        "attributes": {
          "id": node.mRID,
          "name": node.name
        }
    })

    for terminal in node.Terminals:
      equipment = terminal.ConductingEquipment
      eq_class_type = equipment.__class__.__name__

      if eq_class_type in LOAD_TYPES:
        objects.append({
          "objectType": "load",
          "elementType": "node",
          "attributes": {
            "id": terminal.mRID,
            "name": terminal.name,
            "eq_class_type": eq_class_type
          }
        })
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
        objects.append({
            "objectType": "diesel_dg",
            "elementType": "node",
            "attributes": {
              "id": terminal.mRID,
              "name": terminal.name,
              "eq_class_type": eq_class_type
            }
        })
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
        objects.append({
            "objectType": "capacitor",
            "elementType": "node",
            "attributes": {
              "id": terminal.mRID,
              "name": terminal.name,
              "eq_class_type": eq_class_type
            }
        })
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
        objects.append({
            "objectType": "inverter_dyn",
            "elementType": "node",
            "attributes": {
              "id": terminal.mRID,
              "name": terminal.name,
              "eq_class_type": eq_class_type
            }
        })
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
    objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.Terminals[0].mRID,
          "name": line.Terminals[0].name
        }
    })
    objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.Terminals[1].mRID,
          "name": line.Terminals[1].name
        }
    })

    objects.append({
        "objectType": "overhead_line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.Terminals[0].mRID}_{line.Terminals[1].mRID}",
          "from": line.Terminals[0].mRID,
          "to": line.Terminals[1].mRID
        }
    })

    objects.append({
        "objectType": "line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.Terminals[0].mRID}_{line.Terminals[0].ConnectivityNode.mRID}",
          "from": line.Terminals[0].mRID,
          "to": line.Terminals[0].ConnectivityNode.mRID
        }
    })

    objects.append({
        "objectType": "line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.Terminals[1].mRID}_{line.Terminals[1].ConnectivityNode.mRID}",
          "from": line.Terminals[1].mRID,
          "to": line.Terminals[1].ConnectivityNode.mRID
        }
    })

  CIM_NETWORK.get_all_edges(cim.PowerTransformer)
  CIM_NETWORK.get_all_edges(cim.PowerTransformerEnd)
  CIM_NETWORK.get_all_edges(cim.TransformerTank)
  CIM_NETWORK.get_all_edges(cim.TransformerTankEnd)
    
  for line in CIM_NETWORK.graph[cim.TransformerTank].values():
    objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.TransformerTankEnds[0].Terminal.mRID,
          "name": line.TransformerTankEnds[0].Terminal.name
        }
    })
    objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.TransformerTankEnds[1].Terminal.mRID,
          "name": line.TransformerTankEnds[1].Terminal.name
        }
    })

    if (len(line.TransformerTankEnds) > 2):
      phantom_node_id = f"phantom_node_id_{phantom_node_count}"
      
      objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.TransformerTankEnds[2].Terminal.mRID,
          "name": line.TransformerTankEnds[2].Terminal.name
        }
      })

      objects.append({
        "objectType": "phantom_node",
        "elementType": "node",
        "attributes": {
          "id": phantom_node_id
        }
      })

      objects.append({
        "objectType": "transformer",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.TransformerTankEnds[0].Terminal.mRID}_{phantom_node_id}",
          "from": line.TransformerTankEnds[0].Terminal.mRID,
          "to": phantom_node_id
        }
      })
        
      objects.append({
        "objectType": "transformer",
        "elementType": "edge",
        "attributes": {
          "id": f"{phantom_node_id}_{line.TransformerTankEnds[1].Terminal.mRID}",
          "from": phantom_node_id,
          "to": line.TransformerTankEnds[1].Terminal.mRID
        }
      })
      
      objects.append({
        "objectType": "transformer",
        "elementType": "edge",
        "attributes": {
          "id": f"{phantom_node_id}_{line.TransformerTankEnds[2].Terminal.mRID}",
          "from": phantom_node_id,
          "to": line.TransformerTankEnds[2].Terminal.mRID
        }
      })
      
      objects.append({
        "objectType": "line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.TransformerTankEnds[2].Terminal.mRID}_{line.TransformerTankEnds[2].Terminal.ConnectivityNode.mRID}",
          "from": line.TransformerTankEnds[2].Terminal.mRID,
          "to": line.TransformerTankEnds[2].Terminal.ConnectivityNode.mRID
        }
      })

      phantom_node_count += 1
    else:
      objects.append({
        "objectType": "transformer",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.TransformerTankEnds[0].Terminal.mRID}_{line.TransformerTankEnds[1].Terminal.mRID}",
          "from": line.TransformerTankEnds[0].Terminal.mRID,
          "to": line.TransformerTankEnds[1].Terminal.mRID
        }
      })

    objects.append({
      "objectType": "line",
      "elementType": "edge",
      "attributes": {
        "id": f"{line.TransformerTankEnds[0].Terminal.mRID}_{line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID}",
        "from": line.TransformerTankEnds[0].Terminal.mRID,
        "to": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID
      }
    })

    objects.append({
      "objectType": "line",
      "elementType": "edge",
      "attributes": {
        "id": f"{line.TransformerTankEnds[1].Terminal.mRID}_{line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID}",
        "from": line.TransformerTankEnds[1].Terminal.mRID,
        "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID
      }
    })
    
  for line in CIM_NETWORK.graph[cim.PowerTransformer].values():
    if line.PowerTransformerEnd:
      objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.PowerTransformerEnd[0].Terminal.mRID,
          "name": line.PowerTransformerEnd[0].Terminal.name
        }
      })
      
      objects.append({
        "objectType": "terminal",
        "elementType": "node",
        "attributes": {
          "id": line.PowerTransformerEnd[1].Terminal.mRID,
          "name": line.PowerTransformerEnd[1].Terminal.name
        }
      })
        
      if (len(line.PowerTransformerEnd) > 2):
        phantom_node_id = f"phantom_node_id_{phantom_node_count}"

        objects.append({
          "objectType": "terminal",
          "elementType": "node",
          "attributes": {
            "id": line.PowerTransformerEnd[2].Terminal.mRID,
            "name": line.PowerTransformerEnd[2].Terminal.name
          }
        })
        
        objects.append({
          "objectType": "phantom_node",
          "elementType": "node",
          "attributes": {
            "id": phantom_node_id
          }
        })
        
        objects.append({
            "objectType": "transformer",
            "elementType": "edge",
            "attributes": {
              "id": f"{line.PowerTransformerEnd[0].Terminal.mRID}_{phantom_node_id}",
              "from": line.PowerTransformerEnd[0].Terminal.mRID,
              "to": phantom_node_id
            }
        })

        objects.append({
            "objectType": "transformer",
            "elementType": "edge",
            "attributes": {
              "id": f"{phantom_node_id}_{line.PowerTransformerEnd[1].Terminal.mRID}",
              "from": phantom_node_id,
              "to": line.PowerTransformerEnd[1].Terminal.mRID
            }
        })
        
        objects.append({
            "objectType": "transformer",
            "elementType": "edge",
            "attributes": {
              "id": f"{phantom_node_id}_{line.PowerTransformerEnd[2].Terminal.mRID}",
              "from": phantom_node_id,
              "to": line.PowerTransformerEnd[2].Terminal.mRID
            }
        })
        
        objects.append({
          "objectType": "line",
          "elementType": "edge",
          "attributes": {
            "id": f"{line.PowerTransformerEnd[2].Terminal.mRID}_{line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID}",
            "from": line.PowerTransformerEnd[2].Terminal.mRID,
            "to": line.PowerTransformerEnd[2].Terminal.ConnectivityNode.mRID
          }
        })

        phantom_node_count += 1
      else:
        objects.append({
          "objectType": "transformer",
          "elementType": "edge",
          "attributes": {
            "id": f"{line.PowerTransformerEnd[0].Terminal.mRID}_{line.PowerTransformerEnd[1].Terminal.mRID}",
            "from": line.PowerTransformerEnd[0].Terminal.mRID,
            "to": line.PowerTransformerEnd[1].Terminal.mRID
          }
        }) 
        
      objects.append({
        "objectType": "line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.PowerTransformerEnd[0].Terminal.mRID}_{line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID}",
          "from": line.PowerTransformerEnd[0].Terminal.mRID,
          "to": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID
        }
      })   
      
      objects.append({
        "objectType": "line",
        "elementType": "edge",
        "attributes": {
          "id": f"{line.PowerTransformerEnd[1].Terminal.mRID}_{line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID}",
          "from": line.PowerTransformerEnd[1].Terminal.mRID,
          "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID
        }
      })

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
        objects.append({
          "objectType": "terminal",
          "elementType": "node",
          "attributes": {
            "id": line.Terminals[0].mRID,
            "name": line.Terminals[0].name
          }
        })
        
        objects.append({
          "objectType": "terminal",
          "elementType": "node",
          "attributes": {
            "id": line.Terminals[1].mRID,
            "name": line.Terminals[1].name
          }
        })

        objects.append({
          "objectType": "switch",
          "elementType": "edge",
          "attributes": {
            "id": f"{line.Terminals[0].mRID}_{line.Terminals[1].mRID}",
            "from": line.Terminals[0].mRID,
            "to": line.Terminals[1].mRID
          }
        })

        objects.append({
          "objectType": "line",
          "elementType": "edge",
          "attributes": {
            "id": f"{line.Terminals[0].mRID}_{line.Terminals[0].ConnectivityNode.mRID}",
            "from": line.Terminals[0].mRID,
            "to": line.Terminals[0].ConnectivityNode.mRID
          }
        })

        objects.append({
          "objectType": "line",
          "elementType": "edge",
          "attributes": {
            "id": f"{line.Terminals[1].mRID}_{line.Terminals[1].ConnectivityNode.mRID}",
            "from": line.Terminals[1].mRID,
            "to": line.Terminals[1].ConnectivityNode.mRID
          }
        })

  return json.dumps({cim_filepath: {"objects": objects}})
      
def exportCIM(dir2save: str, data):
  # RDFLib File Reader Connection
  # use cim_builder 
  if len(data["objs"]) == 0:
    print("No objects to export creating copy of the original file")
    cim_utils.get_all_data(CIM_NETWORK)
    cim_utils.write_xml(CIM_NETWORK, dir2save + "\\cim_output.xml")
    return 

  feeder = cim.Feeder()

  for nodes in data["objs"]:
    c_node = cim.ConnectivityNode(mRID=f"{nodes[1]['mRID'].upper()}", name=nodes[1]['name'])
    c_node.ConnectivityNodeContainer = feeder
    new_terminal = cim.Terminal(mRID=f"{nodes[0]['mRID'].upper()}", name=nodes[0]['name'])
    terminal_1 = cim.Terminal(mRID=f"{nodes[2]['mRID'].upper()}", name=nodes[2]['name'])
    terminal_2 = cim.Terminal(mRID=f"{nodes[3]['mRID'].upper()}", name=nodes[3]['name'])
    ACLine = cim.ACLineSegment(mRID=f"{str(uuid4()).upper()}", name=f"l:{nodes[4]['id'].split(':')[1]}")
    ACLine.EquipmentContainer = feeder
    parent_c_node = CIM_NETWORK.graph[cim.ConnectivityNode][nodes[3]['parent']]
    
    new_terminal.ConnectivityNode = c_node
    terminal_1.ConnectivityNode = c_node
    terminal_2.ConnectivityNode = parent_c_node
    
    terminal_1.ConductingEquipment = ACLine
    terminal_2.ConductingEquipment = ACLine
    
    if nodes[0]['group'] == "diesel_dg":
      # scynchronous generator
        energy_source = cim.EnergySource(mRID=f"{str(uuid4()).upper()}", name=f"source:{rand.randint(1,999)}")
        new_terminal.ConductingEquipment = energy_source
    if nodes[0]['group'] == "load":
        energy_consumer = cim.EnergyConsumer(mRID=f"{str(uuid4()).upper()}", name=f"consumer:{rand.randint(1,999)}")
        new_terminal.ConductingEquipment = energy_consumer
        
        # new power electronics connection
        
    # c_node.Terminals = [new_terminal, terminal_1]
    
  CIM_NETWORK.add_to_graph(new_terminal)
  CIM_NETWORK.add_to_graph(ACLine)
  CIM_NETWORK.add_to_graph(terminal_1)
  CIM_NETWORK.add_to_graph(terminal_2)
  CIM_NETWORK.add_to_graph(c_node)
  
  cim_utils.get_all_data(CIM_NETWORK)
  cim_utils.write_xml(CIM_NETWORK, dir2save + "\\cim_output.xml")
      
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
      "#Nodes": GRAPH.number_of_nodes(),
      "#Edges": GRAPH.number_of_edges(),
      "#ConnectedComponets": nx.number_connected_components(GRAPH),
      "modularity": get_modularity(),
      "avgBetweennessCentrality": get_avg_betweenness_centrality()
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
  print(cim_data)
  export_dir = cim_data["savepath"]
  print(export_dir)
  data = cim_data["data"]

  exportCIM(export_dir, data)
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
