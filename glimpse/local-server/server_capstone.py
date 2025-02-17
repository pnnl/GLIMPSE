from flask import Flask, request as req
from flask_socketio import SocketIO
import networkx as nx
import glm
import json
from os import path

import socket
#client_socket = socket.socket() #socket.AF_INET, socket.SOCK_DGRAM)
#client_socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024*10)
#client_socket.settimeout(2.0)
#natig_server_addr = ("localhost", 8080)

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

GRAPH = nx.MultiGraph()

#Convert glm file to python dictionary
def glm_to_dict( file_paths: list ) -> dict:
   glm_dicts = {}
   for glm_path in file_paths:
      glm_dicts[ path.basename(glm_path).split(".")[0] + ".json" ] = glm.load(glm_path)

   return glm_dicts

#Converts glm dict to json
def dict2json( glm_dict: dict ) -> str:
   glm_json = json.dumps( glm_dict, indent= 3 )
   return glm_json

def create_graph(data: dict, set_communities: bool=False) -> dict:
   GRAPH.clear()

   for obj in data["objects"]:
      if obj["elementType"] == "node":
         GRAPH.add_node(obj["attributes"]["id"], objectType = obj["objectType"], attributes = obj["attributes"])
      else:
         GRAPH.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], obj["attributes"]["id"])

   if set_communities : 
      partition = nx.algorithms.community.louvain_communities(G=GRAPH, resolution=1, max_level=5)

      community_ids = {node: community_id for community_id, community in enumerate(partition) for node in community}

      nx.set_node_attributes(GRAPH, community_ids, "glimpse_community_id")
      return nx.get_node_attributes(G=GRAPH, name="glimpse_community_id")

def get_modularity() -> float:
   modularity = nx.community.modularity(GRAPH, nx.community.label_propagation_communities(GRAPH))
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
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

#------------------------------ End Server ------------------------------#

#------------------------------ Server Routes ------------------------------#

@app.route("/")
def hello():
   return {"api": "GLIMPSE flask backend"}

'''
This endpoint gets the paths of the uploaded glm files to be converted to JSON
'''
@app.route("/glm2json", methods=["POST"])
def glm_to_json():
   paths = req.get_json()
   glm_dict = glm_to_dict(paths)
   
   return dict2json(glm_dict)

@app.route("/update", methods=["POST"])
def update():
   obj = req.get_json()
   socketio.emit(obj[0], obj)
   # global output = str(obj)
   return obj

""" @app.route("/getOBJ", methods=["GET"])
def read_obj():
   return output """

'''
This endpoint will create a networkx GRAPH object in this server. If the graph data is a list
then most likely there is a true value where this end point needs to return a dict of community IDs
'''
@app.route("/create-nx-graph", methods=["POST"])
def create_nx_graph(): 
   graphData = req.get_json()

   if isinstance(graphData, dict):
      create_graph(graphData)
      return "", 204
   elif isinstance(graphData, list):
      #index 0 contains the data and index 1 contains a bool value whether to set the community IDs as well
      community_ids = create_graph(data=graphData[0], set_communities=graphData[1])
      return community_ids

'''
This endpoint gathers some summary statistics using networkx and the already existing GRAPH object.
'''
@app.route("/get-stats", methods=["GET"])
def get_stats():
   summary_stats = {
      "#Nodes": GRAPH.number_of_nodes(),
      "#Edges": GRAPH.number_of_edges(),
      "#ConnectedComponets": nx.number_connected_components(GRAPH),
      "modularity": get_modularity(),
      "avgBetweennessCentrality": get_avg_betweenness_centrality()
   }
   
   return summary_stats

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

@socketio.on("natig-config")
def natig_config(configObj):
   # send config 
   socketio.emit("newNatigConfig", configObj)
   print(f"data received in backend: {str(configObj)}")

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
   socketio.run(app, port=5051, debug=True)
   
#-------------------------- End Start WebSocket Server --------------------------#
