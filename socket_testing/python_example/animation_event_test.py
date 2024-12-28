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
animate_edge = {
   "objectType": "edge",
   "id": "cap_92-load_39",
   "updates": {
      "animation": True
   }
}

def main(): 
   sio = socketio.Client()
   sio.connect(f"{URL}:{PORT}")
   
   if sio.connected:
      sio.emit("addEdge", new_edge)
      time.sleep(1.5)
      sio.emit("glimpse", animate_edge)
      time.sleep(1)
   else:
      print(f"did not connect to socket server at: {URL}:{PORT}")
   
   sio.disconnect()

if __name__ == "__main__": 
   main()
