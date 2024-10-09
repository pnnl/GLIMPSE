import socketio
import json
import time

PORT = 5051
URL = "http://127.0.0.1"

newNodes = [
   {
      "objectType": "Switch", # Like a group or category the node belongs under
      "elementType": "node",
      "attributes": {
         "id": "switch1",
         "ipaddress": "192.168.0.2"
      },
      "styles": {
         "label": "192.168.0.2",
         "color": "orange", # Can be hex, rgb, rgba, or a named color like "blue"
         "shape": "triangle",
         "size": 12
      }
   },
   {
      "objectType": "Switch",
      "elementType": "node",
      "attributes": {
         "id": "switch2",
         "ipaddress": "192.168.0.1"
      },
      "styles": {
         "label": "192.168.0.1",
         "color": "orange", 
         "shape": "triangle",
         "size": 12
      }
   },
   {
      "objectType": "Switch",
      "elementType": "node",
      "attributes": {
         "id": "switch3",
         "ipaddress": "192.168.0.3"
      },
      "styles": {
         "label": "192.168.0.3",
         "color": "orange", 
         "shape": "triangle",
         "size": 12
      }
   },  
   {
      "objectType": "Computer",
      "elementType": "node",
      "attributes": {
         "id": "computer1",
         "ipaddress": "192.168.0.103"
      },
      "styles": {
         "label": "192.168.0.103",
         "color": "#2B7CE9", 
         "shape": "dot",
         "size": 12
      }
   },
   {
      "objectType": "Computer",
      "elementType": "node",
      "attributes": {
         "id": "computer2",
         "ipaddress": "192.168.0.100"
      },
      "styles": {
         "label": "192.168.0.100",
         "color": "#2B7CE9", 
         "shape": "dot",
         "size": 12
      }
   },
   {
      "objectType": "Computer",
      "elementType": "node",
      "attributes": {
         "id": "computer3",
         "ipaddress": "192.168.0.102"
      },
      "styles": {
         "label": "192.168.0.102",
         "color": "#2B7CE9", 
         "shape": "dot",
         "size": 12
      }
   },
   {
      "objectType": "Smartphone",
      "elementType": "node",
      "attributes": {
         "id": "phone1",
         "ipaddress": "192.168.0.230"
      },
      "styles": { 
         "label": "192.168.0.230",
         "color": "#5A1E5C",
         "shape": "dot",
         "size": 10
      }
   },
   {
      "objectType": "Smartphone",
      "elementType": "node",
      "attributes": {
         "id": "phone2",
         "ipaddress": "192.168.0.231"
      },
      "styles": { 
         "label": "192.168.0.231",
         "color": "#5A1E5C",
         "shape": "dot",
         "size": 10
      }
   },
   {
      "objectType": "Server",
      "elementType": "node",
      "attributes": {
         "id": "server1",
         "ipaddress": "192.168.0.10"
      },
      "styles": { 
         "label": "192.168.0.10",
         "color": "#C5000B",
         "shape": "square",
         "size": 20
      }
   },
   {
      "objectType": "Internet",
      "elementType": "node",
      "attributes": {
         "id": "internet1",
      },
      "styles": { 
         "label": "internet",
         "color": "#109618",
         "shape": "square",
         "size": 16
      }
   },
    
]

'''
Setting the element type to "edge" lets GLIMPSE 
know to look for the "to" and "from" 
keys in the attributes dict and create the edge object
'''
newEdges = [
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "switch1-switch2",
         "strength": "strong",
         "speed": "0.71 mbps",
         "from": "switch1",
         "to": "switch2"
      },
      "styles": {
         "color": "grey",
         "width": 4,
         "label": "0.71 mbps"
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "switch2-switch3",
         "strength": "weak",
         "speed": "0.55 mbps",
         "from": "switch2",
         "to": "switch3"
      },
      "styles": {
         "color": "grey",
         "width": 3,
         "label": "0.55 mbps"
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "computer1-switch1",
         "from": "computer1",
         "to": "switch1"
      },
      "styles": {
         "color": "grey",
         "width": 2,
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "computer2-switch1",
         "from": "computer2",
         "to": "switch1"
      },
      "styles": {
         "color": "grey",
         "width": 2,
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "computer3-switch1",
         "from": "computer3",
         "to": "switch1"
      },
      "styles": {
         "color": "red",
         "width": 2,
         "label": "error"
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "phone1-switch3",
         "from": "phone1",
         "to": "switch3"
      },
      "styles": {
         "color": "grey",
         "width": 2,
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "phone2-switch3",
         "from": "phone2",
         "to": "switch3"
      },
      "styles": {
         "color": "grey",
         "width": 2,
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "switch2-server1",
         "from": "switch2",
         "to": "server1",
         "strength": "strong"
      },
      "styles": {
         "label": "0.92 mbps",
         "color": "grey",
         "width": 6,
      }
   },
   {
      "objectType": "connection",
      "elementType": "edge",
      "attributes": {
         "id": "switch2-internet1",
         "from": "switch2",
         "to": "internet1",
         "strength": "normal"
      },
      "styles": {
         "color": "grey",
         "width": 2,
         "label": "0.63mbps"
      }
   },
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
   }
   # {
   #    "elementType": "node",
   #    "id": "switch1",
   #    "updates": {
   #       "color": "cyan",
   #       "opacity": 0.2,
   #       "shape": "triangleDown",
   #       "size": 90
   #    }
   # },
   #   {
   #    "elementType": "edge",
   #    "id": "switch1-switch2",
   #    "updates": {
   #       "color": "red",
   #       "dashed": True,
   #       "width": 12
   #    }
   # },
   #   {
   #    "elementType": "edge",
   #    "id": "switch2-internet1",
   #    "updates": {
   #       "color": "purple",
   #       "width": 15,
   #       "arrows": "to, from, middle"
   #    }
   # },
]

def main():
   sio = socketio.Client()
   sio.connect(f"{URL}:{PORT}")
   
   # # create new nodes in GLIMPSE with the addNode socket event
   # for new_node_obj in newNodes: 
   #    sio.emit("addNode", new_node_obj)
   #    time.sleep(0.75)
      
   # # create new edges between the added nodes in GLIMPSE
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

   for style in styleChanges: 
      sio.emit("glimpse", style)
      time.sleep(1.5)
   
   # disconect from GLIMPSE WebSocket API      
   sio.disconnect()

if __name__ == "__main__": 
   main()
