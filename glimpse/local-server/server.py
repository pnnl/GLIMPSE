from flask import Flask, request as req
from uuid import uuid4
import networkx as nx
import random as rand
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
   edge_types = [ 
      "microgrid_connection",
      "underground_line",
      "series_reactor",
      "overhead_line",
      "communication",
      "triplex_line",
      "transformer",
      "parentChild",
      "regulator",
      "mapping",
      "switch",
      "line"
   ]
   node_types = [
      "communication_node",
      "triplex_meter", 
      "triplex_load",
      "triplex_node",
      "inverter_dyn",  
      "substation", 
      "capacitor", 
      "diesel_dg", 
      "microgrid",
      "technique",
      "terminal",
      "c_node",
      "capec",
      "meter", 
      "load", 
      "node", 
      "cwe",
      "cve"
   ]

   graph = nx.MultiGraph()

   for glm_file in file_data.values():
      for object in glm_file['objects']:
         obj_type = object['name'].split(':')[0] if ':' in object['name'] else object['name']
         attributes = object['attributes']
         
         if obj_type in node_types:
            object_id = attributes['name']
            
            graph.add_node(object_id, attributes = attributes)

   for glm_file in file_data.values():
      for object in glm_file['objects']:
         obj_type = object['name'].split(':')[0] if ':' in object['name'] else object['name']
         attributes = object['attributes']

         if obj_type in edge_types:
            edge_from = attributes['from'].split(':')[1] if ':' in attributes['from'] else attributes['from']
            edge_to = attributes['to'].split(':')[1] if ':' in attributes['to'] else attributes['to']
            edge_id = object['name'] if ':' in object['name'] else obj_type + ':' + attributes['name']

            graph.add_edge(edge_from, edge_to, id=edge_id, attributes = attributes)
         elif obj_type in node_types:
            try:
               parent = attributes['parent']
               child = attributes['name']
               graph.add_edge(parent, child)
            except:
               pass
            
   return graph

def get_modularity(graph):
   modularity = nx.community.modularity(graph, nx.community.label_propagation_communities(graph))
   print("modularity done")
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

   print(max_bc)
   avg_betweenness_centrality = avg/len(betweenness_centrality_dict)
   
   print("betweenness centrality done")
   return avg_betweenness_centrality
        
#------------------------------ Server ------------------------------#
app = Flask(__name__)

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
   
if __name__=="__main__":
   app.run(debug=True)