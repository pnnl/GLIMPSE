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