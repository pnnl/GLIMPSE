from flask import Flask, request as req
from engineio.async_drivers import gevent
from flask_socketio import SocketIO
import networkx as nx
import glm
import json
from os import path

GRAPH = nx.MultiGraph()

#Convert glm file to python dictionary
def glm_to_dict( file_paths: list ):
   glm_dicts = {}
   for glm_path in file_paths:
      glm_dicts[ path.basename(glm_path).split(".")[0] + ".json" ] = glm.load(glm_path)

   return glm_dicts

#Converts glm dict to json
def dict2json( glm_dict: dict ):
   glm_json = json.dumps( glm_dict, indent= 3 )
   return glm_json

def create_graph(data: dict, set_communities=False):
   GRAPH.clear()

   for obj in data["objects"]:
      if obj["elementType"] == "node":
         GRAPH.add_node(obj["attributes"]["id"], objectType = obj["objectType"], attributes = obj["attributes"])
      else:
         GRAPH.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], obj["attributes"]["id"])

   if set_communities : 
      partition = nx.algorithms.community.louvain_communities(G=GRAPH, max_level=5)

      community_ids = {node: community_id for community_id, community in enumerate(partition) for node in community}

      nx.set_node_attributes(GRAPH, community_ids, "glimpse_community_id")
      return nx.get_node_attributes(G=GRAPH, name="glimpse_community_id")

def get_modularity():
   modularity = nx.community.modularity(GRAPH, nx.community.label_propagation_communities(GRAPH))
   return modularity

# long computation with larger graphs
def get_avg_betweenness_centrality():
   my_k = int(GRAPH.number_of_nodes()*0.68)
   betweenness_centrality_dict = nx.betweenness_centrality(GRAPH, k=my_k)
   
   centrality_sum = sum(betweenness_centrality_dict.values())
   avg = centrality_sum/len(betweenness_centrality_dict)

   return avg
        
#------------------------------ Server ------------------------------#

app = Flask(__name__)
# socketio = SocketIO(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

#------------------------------ Server ------------------------------#

#------------------------------ Server Routes ------------------------------#

@app.route("/")
def hello():
   return {"api": "GLIMPSE flask backend"}

@app.route("/glm2json", methods=["POST"])
def glm_to_json():
   paths = req.get_json()
   glm_dict = glm_to_dict(paths)
   
   return dict2json(glm_dict)

@app.route("/create-nx-graph", methods=["POST"])
def create_nx_graph(): 
   graphData = req.get_json()

   if isinstance(graphData, dict):
      create_graph(graphData)
      return '', 204
   elif isinstance(graphData, list):
      #index 0 contains the data and index 1 contains a bool value whether to set the community IDs as well
      community_ids = create_graph(data=graphData[0], set_communities=graphData[1])
      return community_ids
      
@app.route("/get-stats", methods=["GET"])
def get_stats():
   summary_stats = {
      '#Nodes': GRAPH.number_of_nodes(),
      '#Edges': GRAPH.number_of_edges(),
      '#ConnectedComponets': nx.number_connected_components(GRAPH),
      'modularity': get_modularity(),
      'avgBetweennessCentrality': get_avg_betweenness_centrality()
   }
   
   return summary_stats

#------------------------------ Server Routes ------------------------------#

#------------------------------ Socket Events ------------------------------#
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

#------------------------------ Socket Events ------------------------------#

#-------------------------- Start WebSocket Server --------------------------#

if __name__ == "__main__":
   socketio.run(app, port=5051, debug=False, log_output=True)
   
#-------------------------- Start WebSocket Server --------------------------#