import socketio
import time

PORT = 5051
URL = "http://127.0.0.1"

"""
Create a new edge in GLIMPSE
"""
new_edge = {
   "objectType": "underground_line",
   "elementType": "edge",
   "attributes": {
      "id": "cap_92-load_39",
      "from": "cap_92",
      "to": "load_39"
   },
   "styles": {
      "color": "yellow",
      "width": 9,
   }
}

"""
Animate the newly created edge in GLIMPSE
"""
animate_edges = [
   {
      "objectType": "edge",
      "id": "XFMR1",
      "updates": {
         "animation": True,
         "increment": 0.01, # normal speed
         "startFrom": "target"
      }
   },
   {
      "objectType": "edge",
      "id": "Reg1",
      "updates": {
         "animation": True,
         "increment": 0.001, # slowest speed
         "startFrom": "target"
      }
   },
   {
      "objectType": "edge",
      "id": "overhead_line11",
      "updates": {
         "animation": True,
         "increment": 0.1 # fastest speed
      }
   },
   {
      "objectType": "edge",
      "id": "overhead_line1",
      "updates": {
         "animation": True,
         "increment": 0.05 # faster than normal
      }
   },
   {
      "objectType": "edge",
      "id": "overhead_line3",
      "updates": {
         "animation": True,
         "increment": 0.025 # a bit faster than normal
      }
   },
]

def main(): 
   sio = socketio.Client()
   sio.connect(f"{URL}:{PORT}")
   
   if sio.connected:
      for edge in animate_edges:
         sio.emit("glimpse", edge)
         time.sleep(1)
   else:
      print(f"did not connect to socket server at: {URL}:{PORT}")
   
   sio.disconnect()

if __name__ == "__main__": 
   main()
