from socketio import Client
import json
import time
import random

def get_random_hex_color():
   chars = "0123456789ABCDEF"
   color = "#"
   
   while len(color) < 7: 
      color += random.choice(chars)
      
   return color

with open("./test_ids.json", "r") as json_file:
   file_data = json_file.read()
   file_data = json.loads(file_data)
   json_file.close()

'''
the return dict should have the following structure:

nodes: {
   "elementType": "node",
   "id": "id of node to change",
   "color": "in hex",
   "new_size": "within the range of 2 - 45"
}

edges: {   
   "elementType": "edge",
   "id": "id of edge to change",
   "color": "in hex",
   "width": "width of the edge starting from 0.15 to 15.0"
}
'''
def get_update_data():
   type = random.choice(["nodes", "edges"])

   if type == "nodes": 
      update_data = {
         "elementType": "node",
         "id": random.choice(file_data[type]),
         "color": get_random_hex_color(),
         "new_size": random.randint(2, 45)
      }
   else:
      update_data = {
         "elementType": "edge",
         "id": random.choice(file_data[type]),
         "color": get_random_hex_color(),
         "width": random.randint(15, 1500)/100
      }
   
   return update_data

# ------------------ Connecting to Socket Server ------------------ #
sio = Client()
sio.connect("http://127.0.0.1:5000")

# sending styling data every second for 100 seconds to the glmipse socket event
for i in range(100): 
   sio.emit("glimpse", get_update_data())
   time.sleep(1)
   
sio.disconnect()