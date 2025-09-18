from flask import Flask, send_file, request as req
from flask_cors import CORS
from flask_socketio import SocketIO
import networkx as nx
import socket
import glm
import json
import os
from datetime import datetime

GRAPH = nx.MultiGraph()
def start_client(message):
  # Create socket
  client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
  client_socket.settimeout(2.0)
  # Connection details
  host = '127.0.0.1'  # Connect to localhost
  port = 65432

  try:
      # Connect to server
      client_socket.connect((host, port))
      print(f"Connected to server at {host}:{port}")

      # Send message to server
      #message = "Hello from client!"
      client_socket.send(message.encode('utf-8'))

      # Receive response
      response = client_socket.recv(1024)
      print(f"Server response: {response.decode('utf-8')}")

  except Exception as e:
      print(f"Error: {e}")
  finally:
      client_socket.close()

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

#------------------------------ Server ------------------------------#

app = Flask(__name__)
# socketio = SocketIO(app)
CORS(app, origins=["http://127.0.0.1:5173", "http://127.0.0.1:65432", "http://localhost:*"])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

#------------------------------ End Server ------------------------------#

#------------------------------ Server Routes ------------------------------#

@app.route("/")
def hello():
  api_doc = os.path.join(os.path.dirname(__file__), "GLIMPSE_Event_API.pdf")

  if os.path.exists(api_doc):
    return send_file(api_doc, mimetype="application/pdf")
  else:
    return {"api": "GLIMPSE WebSocket Backend API"}

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

@app.route("/update", methods=["POST"])
def update():
   obj = req.get_json()
   socketio.emit(obj[0], obj)
   # global output = str(obj)
   return obj

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

@socketio.on('connect')
def connect():
  print(f"{datetime.now().isoformat()} - Client connected")

@socketio.on('csv_data')
def handle_csv_data(data):
  socketio.emit("update-watch-item", data)


@socketio.on('disconnect')
def disconnect():
  print(f"{datetime.now().isoformat()} - Client disconnected")


@socketio.on("natig-config")
def natig_config(configObj):
  socketio.emit("newNatigConfig", configObj)

  try:
    natig_config_str = str(configObj)
    natig_config_str = natig_config_str.replace("'", '"')
    natig_config_str = natig_config_str.replace("False", "false")
    natig_config_str = natig_config_str.replace("True", "true")
    start_client(natig_config_str)
    #client_socket.sendto(natig_config_str.encode(), natig_server_addr)
    #response, _ = client_socket.recvfrom(1024*10)
    #print(f"Natig server response: {response.decode()}")
  except Exception as e:
    return "did not send {0}".format(e)

  return "got your message!! - Server.py"

#------------------------------ End WebSocket Events ------------------------------#

#-------------------------- Start WebSocket Server --------------------------#

if __name__ == "__main__":
  socketio.run(app, host="127.0.0.1", port=5173, debug=False)

#-------------------------- End Start WebSocket Server --------------------------#
