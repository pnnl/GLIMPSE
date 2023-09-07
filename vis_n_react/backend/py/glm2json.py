import sys
import glm
import os
import json
import re

# getFiles function returns a list of glm files in provided folder path
def getFiles( folder_path ):
   files = []

   for file in os.listdir(folder_path):
      if re.search( ".glm$", file ):
         files.append( file )

   return files

#Convert glm file to python dictionary
def glmToDict( files, file_path ):
   glm_dicts = {}
   for file in files:
      glm_dicts[ file.split(".")[0] + ".json" ] = glm.load(file_path + file)
   return glm_dicts

#Converts glm dict to json
def glm2json( glm_dict ):
   glm_json = json.dumps( glm_dict, indent = 3 )
   return glm_json


'''
this function will create a csv file named map.csv
that will store <node id>, <x>, <y>
'''
# def createMapping( glm_dict ):
#     node_types = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg", "communication_node", "microgrid_node"]
#     map_file = open("./mapping/map.csv", "w")

#     for glm_file in glm_dict.values():
#         for obj in glm_file['objects']:

#             object_type = obj[ 'name' ]

#             if object_type in node_types:
#                 try:
#                     map_file.write(",".join([ obj[ 'attributes' ][ 'name' ], obj[ 'attributes' ][ 'x' ], obj[ 'attributes' ][ 'y' ] ]) + "\n")
#                 except:
#                     break

#creates metrics file
def createMetrics( glm_dict ):
   edge_types = [ 
      "overhead_line", 
      "switch", 
      "underground_line", 
      "series_reactor", 
      "triplex_line", 
      "regulator",
      "transformer" 
   ]
   
   node_types = [ 
      "load", 
      "triplex_load",
      "capacitor", 
      "node", 
      "triplex_node",
      "substation", 
      "meter", 
      "triplex_meter", 
      "inverter_dyn", 
      "inverter", 
      "diesel_dg" 
   ]

   file = open( "./csv/metrics.csv", "w" )
   # mock_data = {
   #    'edges': [],
   #    'nodes': []
   # }

   for glm_file in glm_dict.values():
      for obj in glm_file[ 'objects' ]:
         obj_type = obj['name']

         if obj_type in edge_types:
            edge_from = obj['attributes']['from']
            edge_from = sum(ord(letter) for letter in edge_from)

            edge_to = obj['attributes' ]['to']
            edge_to = sum(ord(letter) for letter in edge_to)

            file.write(",".join([ f"{edge_from}", "0", f"{edge_to}", "1" ]) + "\n")
            try: 
               edgeID = obj['attributes']['name']
            except: 
               edgeID = obj['attributes']['from'] + "-" + obj['attributes']['to']

            # mock_data["edges"].append(edgeID)

         if obj_type in node_types:
               # mock_data["nodes"].append(obj['attributes']['name'])
               try:
                  edge_from = obj['attributes']['name']
                  edge_from = sum(ord(letter) for letter in edge_from)

                  edge_to = obj['attributes']['parent']
                  edge_to = sum(ord(letter) for letter in edge_to)

                  file.write(",".join([ f"{edge_from}", "0", f"{edge_to}", "1" ]) + "\n")
               except:
                  pass
               
   # with open("./mock_Gridlabd_data/data.json", "w") as json_file:
   #    json_file.write(json.dumps( mock_data, indent = 3 ))

def main():
   folder_dir = sys.argv[1]

   file_names = getFiles(folder_dir)
   glm_dict = glmToDict(file_names, folder_dir)

   # removeglm_files(folder_dir)
   createMetrics(glm_dict)
   # createMapping(glm_dict)

   # Writing to glm2json_output.json
   with open("./json/glm2json_output.json", "w") as json_file:
      json_file.write(glm2json(glm_dict))

   sys.stdout.flush()

if __name__ == "__main__":
   main()