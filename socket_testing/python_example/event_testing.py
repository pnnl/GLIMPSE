import socketio
import json
import time

PORT = 5051
URL = "http://127.0.0.1"

# newNodes = [
#       {
#       "objectType": "load",
#       "elementType": "node",
#       "attributes": {
#          "id": "load_12345",
#       },
#       "styles": {
#          "label": "load_12345",
#       }
#    },
#       {
#       "objectType": "load",
#       "elementType": "node",
#       "attributes": {
#          "id": "load_098",
#       },
#       "styles": {
#          "label": "load_098",
#       }
#    },
#       {
#       "objectType": "load",
#       "elementType": "node",
#       "attributes": {
#          "id": "load_56748",
#       },
#       "styles": {
#          "label": "load_56748",
#       }
#    },
#       {
#       "objectType": "load",
#       "elementType": "node",
#       "attributes": {
#          "id": "load_1029",
#       },
#       "styles": {
#          "label": "load_1029",
#       }
#    },
    
# ]

newNodes =[
   {
      "objectType": "attacker",
      "elementType": "node",
      "attributes": {
         "id": "attacker1"
      },
      "styles": {
         "label": "attacker1"
      }
   }
]

'''
Setting the element type to "edge" lets GLIMPSE 
know to look for the "to" and "from" 
keys in the attributes dict and create the edge object
'''
newEdges = [
   {
      "objectType": "overhead_line",
      "elementType": "edge",
      "attributes": {
         "id": "load_1029-node_14",
         "from": "node_14",
         "to": "load_1029"
      },
      "styles": {
         "color": "yellow",
         "width": 4,
      }
   },
   {
      "objectType": "overhead_line",
      "elementType": "edge",
      "attributes": {
         "id": "load_12345-Gen1",
         "from": "Gen1",
         "to": "load_12345"
      },
      "styles": {
         "color": "Green",
         "width": 7,
      }
   },
   {
      "objectType": "regulator",
      "elementType": "edge",
      "attributes": {
         "id": "load_098-cap_88",
         "from": "cap_88",
         "to": "load_098"
      },
      "styles": {
         "color": "pink",
         "width": 10,
      }
   },
   {
      "objectType": "overhead_line",
      "elementType": "edge",
      "attributes": {
         "id": "load_56748-trip_shad_inv5",
         "from": "trip_shad_inv5",
         "to": "load_56748"
      },
      "styles": {
         "color": "grey",
         "width": 11,
      }
   }
]

nodes_to_delete = [
   "phone2",
   "computer3"
]

edges_to_delete = [
   "switch2-internet1",
   "phone1-switch3"
]

styleChanges = [
   {
      "elementType": "edge",
      "id": "sw_123",
      "updates": {
         "animation": True,
         "color": "#4F2FA6",
      }
   },
   {
      "elementType": "node",
      "id": "switch1",
      "updates": {
         "color": "cyan",
         "opacity": 0.2,
         "shape": "triangleDown",
         "size": 90
      }
   },
     {
      "elementType": "edge",
      "id": "switch1-switch2",
      "updates": {
         "color": "red",
         "dashed": True,
         "width": 12
      }
   },
     {
      "elementType": "edge",
      "id": "switch2-internet1",
      "updates": {
         "color": "purple",
         "width": 15,
         "arrows": "to, from, middle"
      }
   },
]

def main():
   sio = socketio.Client()
   sio.connect(f"{URL}:{PORT}")
   
   # create new nodes in GLIMPSE with the addNode socket event
   for new_node_obj in newNodes: 
      sio.emit("addNode", new_node_obj)
      time.sleep(0.75)
      
   # create new edges between the added nodes in GLIMPSE
   # for new_edge_obj in newEdges: 
   #    sio.emit("addEdge", new_edge_obj)
   #    time.sleep(0.75)
      
   # # delete some nodes via the deleteNode socket event
   # for nodeID in nodes_to_delete: 
   #    sio.emit("deleteNode", nodeID)
   #    time.sleep(1)
  
   # # delete some edge via the deleteEdge socket event
   # for edgeID in edges_to_delete: 
   #    sio.emit("deleteEdge", edgeID)
   #    time.sleep(2)

   # for style in styleChanges: 
   #    sio.emit("glimpse", style)
   #    time.sleep(1.5)
   
   # disconect from GLIMPSE WebSocket API      
   sio.disconnect()

if __name__ == "__main__": 
   main()
