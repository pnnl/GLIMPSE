import random
import json
import sys

def get_random_hex_color():
   chars = "0123456789ABCDEF"
   color = "#"
   
   while len(color) < 7: 
      color += random.choice(chars)
      
   return color

def getIds(filepath):
   with open(filepath, "r") as json_file:
      file_data = json.loads(json_file.read())
      json_file.close()
   
   return file_data
   
# ment to be ran in a loop
def get_update_data(ids):

   shapes = [
      "ellipse", 
      "circle", 
      "box", 
      "diamond", 
      "dot", 
      "star", 
      "triangleDown",
      "hexagon",
      "square"
   ]
   
   type = random.choice(["nodes", "edges"])

   if type == "nodes": 
      update_data = {
         "elementType": "node",
         "id": random.choice(ids[type]),
         "updates": {
            "color": {
               "border": get_random_hex_color(),
               "background": get_random_hex_color()
            },
            "opacity": round(random.uniform(0.0, 1.0), 1),
            "hidden": random.choice([False, True]),
            "shape": random.choice(shapes),
            "size": random.randint(5, 50)
         }
      }
   else:
      update_data = {
         "elementType": "edge",
         "id": random.choice(ids[type]),
         "updates": {
            "color": {
               "color": get_random_hex_color(),
               "inherit": random.choice([True, False, "from", "to", "both"]),
               "opacity": round(random.uniform(0.0, 1.0), 1)
            },
            "dashes": random.choice([True, False]),
            "hidden": random.choice([True, False]),
            "length": random.randint(10, 100),
            "width": round(random.uniform(0.15, 8.0), 2)
         }
      }
   
   return update_data

def main(filepath):
   update_file = open("test_update_dataV2.json", "w")
   update_data = {
      "updateData": []
   }
   id_data = getIds(filepath)
   
   for i in range(100):
      update_data["updateData"].append(get_update_data(id_data))
   
   update_file.write(json.dumps(update_data, indent=3))
   update_file.close()

if __name__ == "__main__": 
   main(sys.argv[1])