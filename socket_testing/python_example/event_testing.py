import socketio
import time

PORT = 5051
URL = "http://localhost"

newNodes = [
      {
      "objectType": "load",
      "elementType": "node",
      "attributes": {
         "id": "load_12345",
      },
      "styles": {
         "label": "load_12345",
      }
   },
      {
      "objectType": "load",
      "elementType": "node",
      "attributes": {
         "id": "load_098",
      },
      "styles": {
         "label": "load_098",
      }
   },
      {
      "objectType": "load",
      "elementType": "node",
      "attributes": {
         "id": "load_56748",
      },
      "styles": {
         "label": "load_56748",
      }
   },
      {
      "objectType": "load",
      "elementType": "node",
      "attributes": {
         "id": "load_1029",
      },
      "styles": {
         "label": "load_1029",
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
watch_data = {
  "csv_data": {
    'swt_ln0774458_sw': [
      '2001-08-01 13:00:07.010000 PDT',
      'CLOSED',
      '+9.63955661265-14.0623577778d',
      '+8.1551924716-134.016281602d',
      '+7.4426034034+105.938966144d',
      '+116603.228237+14.0564376654d',
      '+98775.3559799+13.9978321002d', #reactive power, conjugate power
      '+90060.2650275+14.0261453647d',
      'CLOSED',
      'CLOSED',
      'CLOSED'
    ],
    'swt_l5491_48332_sw': [
      '2001-08-01 13:00:07.010000 PDT',
      'CLOSED',
      '+0+0d',
      '+1.89651096488-134.342277455d',
      '+0+0d',
      '+0+0d',
      '+22958.0367028+14.3165007098d',
      '+0+0d',
      'CLOSED',
      'CLOSED',
      'CLOSED'
    ],
    'swt_l5659_48332_sw': [
      '2001-08-01 13:00:07.010000 PDT',
      'CLOSED',
      '+0+0d',
      '+8.404092458-137.491943055d',
      '+0+0d',
      '+0+0d',
      '+105362.444705+16.8424646869d',
      '+0+0d',
      'CLOSED',
      'CLOSED',
      'CLOSED'
    ]
  }
}

def main():
  sio = socketio.SimpleClient()
  sio.connect(url=f"{URL}:{PORT}", transports=["websocket"])

  if sio.connected:
    time.sleep(2)
    print(watch_data)
    sio.emit('csv_data', watch_data)
    time.sleep(2)
    sio.disconnect()

  #  # create new nodes in GLIMPSE with the addNode socket event
  #  for new_node_obj in newNodes:
  #     sio.emit("addNode", new_node_obj)
  #     time.sleep(0.75)

  #  # create new edges between the added nodes in GLIMPSE
  #  for new_edge_obj in newEdges:
  #     sio.emit("addEdge", new_edge_obj)
  #     time.sleep(0.75)

  #  # delete some nodes via the deleteNode socket event
  #  for nodeID in nodes_to_delete:
  #     sio.emit("deleteNode", nodeID)
  #     time.sleep(1)

  #  # delete some edge via the deleteEdge socket event
  #  for edgeID in edges_to_delete:
  #     sio.emit("deleteEdge", edgeID)
  #     time.sleep(2)

  #  for style in styleChanges:
  #     sio.emit("glimpse", style)
  #     time.sleep(1.5)



   # disconect from GLIMPSE WebSocket API

if __name__ == "__main__":
   main()
