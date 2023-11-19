import networkx as nx
# import matplotlib.pyplot as plt
import json
import sys

def get_nx_graph_object(file_data):

   edge_types = [ 
      'overhead_line', 
      'switch', 
      'underground_line', 
      'series_reactor', 
      'triplex_line', 
      'regulator',
      'transformer' 
   ]

   node_types = [
      'load', 
      'triplex_load',
      'capacitor', 
      'node', 
      'triplex_node',
      'substation', 
      'meter', 
      'triplex_meter', 
      'inverter_dyn', 
      'inverter', 
      'diesel_dg'
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

            graph.add_edge(edge_from, edge_to, id=  edge_id, attributes = attributes)
         elif obj_type in node_types:
            try:
               parent = attributes['parent']
               child = attributes['name']
               graph.add_edge(parent, child)
            except:
               pass

   return graph

# options = {
#    'font_size': 6,
#    'font_weight': 500,
#    'node_size': 125,
#    'alpha': 0.8,
#    'node_color': 'cyan',
#    'width': 2,
#    'with_labels': True
# }

def get_modularity(graph):
   modularity = nx.community.modularity(graph, nx.community.label_propagation_communities(graph))
   return modularity

def get_avg_betweenness_centrality(graph):
   avg = 0

   betweenness_centrality_dict = nx.betweenness_centrality(graph)
   for centrality in betweenness_centrality_dict.values(): 
      avg += centrality

   avg_betweenness_centrality = avg/len(betweenness_centrality_dict)
   
   return avg_betweenness_centrality

def main():  
   file_path = sys.argv[1]
   json_file = open(file_path, "r")
   json_data = json.load(json_file)

   G = get_nx_graph_object(json_data)

   summary_stats = {
      '#Nodes': G.number_of_nodes(),
      '#Edges': G.number_of_edges(),
      '#ConnectedComponets': nx.number_connected_components(G),
      'modularity': get_modularity(G),
      'avgBetweennessCentrality': get_avg_betweenness_centrality(G)
   }
   
   print(json.dumps(summary_stats))
   sys.stdout.flush()

if __name__ == "__main__":
   main()

   