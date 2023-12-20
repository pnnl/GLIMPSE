import sys
import glm
import ntpath
import json

# return the file name only
def path_leaf(path):
   head, tail = ntpath.split(path)
   return tail or ntpath.basename(head)

#Convert glm file to python dictionary
def glmToDict( files ):
   glm_dicts = {}

   for file in files:
      glm_dicts[ path_leaf(file).split(".")[0] + ".json" ] = glm.load(file)

   return glm_dicts

#Converts glm dict to json
def glm2json( glm_dict ):
   glm_json = json.dumps( glm_dict, indent = 3 )
   return glm_json

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

   file = open( "./backend/csv/metrics.csv", "w" )

   for glm_file in glm_dict.values():
      for obj in glm_file[ 'objects' ]:
         obj_type = obj['name']

         if obj_type in edge_types:
            edge_from = obj['attributes']['from']
            edge_from = sum(ord(letter) for letter in edge_from)

            edge_to = obj['attributes' ]['to']
            edge_to = sum(ord(letter) for letter in edge_to)

            file.write(",".join([ f"{edge_from}", "0", f"{edge_to}", "1" ]) + "\n")

         if obj_type in node_types:
            try:
               edge_from = obj['attributes']['name']
               edge_from = sum(ord(letter) for letter in edge_from)

               edge_to = obj['attributes']['parent']
               edge_to = sum(ord(letter) for letter in edge_to)

               file.write(",".join([ f"{edge_from}", "0", f"{edge_to}", "1" ]) + "\n")
            except:
               pass


def main():

   file_names = sys.argv[1:]
   glm_dict = glmToDict(file_names)

   print(json.dumps(glm_dict))

if __name__ == "__main__":
   main()