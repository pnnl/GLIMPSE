import socketio
import json
import sys
import time
# import random

# def get_random_hex_color():
#    chars = "0123456789ABCDEF"
#    color = "#"
   
#    while len(color) < 7: 
#       color += random.choice(chars)
      
#    return color

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
# with open("./test_ids.json", "r") as json_file:
#    file_data = json.loads(json_file.read())
#    json_file.close()
   
# ment to be ran in a loop
# def get_update_data():

#    type = random.choice(["nodes", "edges"])

#    if type == "nodes": 
#       update_data = {
#          "elementType": "node",
#          "id": random.choice(file_data[type]),
#          "color": get_random_hex_color(),
#          "new_size": random.randint(2, 45)
#       }
#    else:
#       update_data = {
#          "elementType": "edge",
#          "id": random.choice(file_data[type]),
#          "color": get_random_hex_color(),
#          "width": random.randint(15, 1500)/100
#       }
   
#    return update_data

def get_update_data(filepath):
   file = open(filepath, "r")
   file_data = json.loads(file.read())
   
   file.close()
   return file_data["update_data"]

# ------------------ Connecting to Socket Server ------------------ #
def main(filepath):
   sio = socketio.Client()
   sio.connect("http://127.0.0.1:5000")

   update_data = get_update_data(filepath)
   
   for update_obj in update_data:
      sio.emit("glimpse", update_obj)
      time.sleep(1)
      
   sio.disconnect()

if __name__ == "__main__":
   # send in the path of the json file with update data
   main(sys.argv[1])