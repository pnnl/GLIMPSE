from flask import Flask, request as req
from flask_socketio import SocketIO
import networkx as nx
import glm
import json
from os import path

GRAPH = nx.MultiGraph()

def glm_to_dict( file_paths: list ) -> dict:
   glm_dicts = {}
   for glm_path in file_paths:
      glm_dicts[ path.basename(glm_path).split(".")[0] + ".json" ] = glm.load(glm_path)

   return glm_dicts

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


@app.route("/glm2json", methods=["POST"])
def glm_to_json():
   '''
   This endpoint gets the paths of the uploaded glm files to be converted to JSON
   '''
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
         with open(path.join(save_dir, filename), "w") as glm_file:
            glm.dump(data[filename], glm_file)
            glm_file.close()

   return "", 204
   
@app.route("/create-nx-graph", methods=["POST"])
def create_nx_graph(): 
   '''
   This endpoint will create a networkx GRAPH object in this server. If the graph data is a list
   then most likely there is a true value where this end point needs to return a dict of community IDs
   '''
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
   '''
   This endpoint gathers some summary statistics using networkx and the already existing GRAPH object.
   '''
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

#------------------------------ End WebSocket Events ------------------------------#

#-------------------------- Start WebSocket Server --------------------------#

if __name__ == "__main__":
   socketio.run(app, port=5051, debug=False)
   
#-------------------------- End Start WebSocket Server --------------------------#
