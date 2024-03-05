from flask import Flask, request as req
from flask_socketio import SocketIO
import networkx as nx
import glm
import ntpath
import json

# return the file name only
def path_leaf(path: str):
   head, tail = ntpath.split(path)
   return tail or ntpath.basename(head)

#Convert glm file to python dictionary
def glm_to_dict( file_paths: list ):
   glm_dicts = {}

   for path in file_paths:
      glm_dicts[ path_leaf(path).split(".")[0] + ".json" ] = glm.load(path)

   return glm_dicts

#Converts glm dict to json
def dict2json( glm_dict: dict ):
   glm_json = json.dumps( glm_dict, indent = 3 )
   return glm_json

def get_nx_graph(file_data: dict):
   graph = nx.MultiGraph()

   for obj in file_data["objects"]:
      if obj["elementType"] == "node":
         graph.add_node(obj["attributes"]["id"], objectType = obj["objectType"], attributes = obj["attributes"])
      else:
         graph.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], obj["attributes"]["id"])
                        
   return graph

def get_modularity(graph):
   modularity = nx.community.modularity(graph, nx.community.label_propagation_communities(graph))
   return modularity

# long computation with larger graphs
def get_avg_betweenness_centrality(graph):
   avg = 0
   max_bc = 0
   myk = int(graph.number_of_nodes()*0.68)
   betweenness_centrality_dict = nx.betweenness_centrality(graph, k=myk)
   
   for centrality in betweenness_centrality_dict.values():
      if centrality > max_bc:
         max_bc = centrality
      avg += centrality

   return avg/len(betweenness_centrality_dict)
        
#------------------------------ Server ------------------------------#
app = Flask(__name__)
app.config["SECRET_KEY"] = "aSecRetKey"
socketio = SocketIO(app)

@app.route("/")
def hello():
   return {"api": "GLIMPSE flask backend"}

@app.route("/glm2json", methods=["POST"])
def glm_to_json():
   paths = req.get_json()
   glm_dict = glm_to_dict(paths)
   
   return dict2json(glm_dict)

@app.route("/getstats", methods=["POST"])
def get_stats():
   data = req.get_json()
   graph = get_nx_graph(data)
   
   summary_stats = {
      '#Nodes': graph.number_of_nodes(),
      '#Edges': graph.number_of_edges(),
      '#ConnectedComponets': nx.number_connected_components(graph),
      'modularity': get_modularity(graph),
      'avgBetweennessCentrality': get_avg_betweenness_centrality(graph)
   }
   
   return summary_stats

@socketio.on("glimpse")
def glimpse(data):
   socketio.emit("update-data", json.dumps(data))
   
if __name__=="__main__":
   socketio.run(app, debug=True, allow_unsafe_werkzeug=True)