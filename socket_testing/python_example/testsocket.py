import socketio
import json
import sys
import time

PORT = 5000
URL = "http://127.0.0.1"

def get_update_data(filepath):
   file = open(filepath, "r")
   file_data = json.loads(file.read())
   
   file.close()
   return file_data["updateData"]

# ------------------ Connecting to Socket Server ------------------ #
def main(filepath):
   sio = socketio.Client()
   sio.connect(f"{URL}:{PORT}")

   update_data = get_update_data(filepath)
   
   for update_obj in update_data:
      sio.emit("glimpse", update_obj)
      time.sleep(0.5)
      
   sio.disconnect()

if __name__ == "__main__":
   # send in the path of the json file with update data
   main(sys.argv[1])