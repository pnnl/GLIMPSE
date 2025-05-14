import socketio
import json
import sys
import time

PORT = 5173
URL = "http://127.0.0.1"

sio = socketio.Client()
sio.connect(f"{URL}:{PORT}")


def get_update_data(filepath):
   file = open(filepath, "r")
   file_data = json.loads(file.read())
   
   file.close()
   return file_data["updateData"]

@sio.on("my_response")
def my_response(data):
    print('Message from server:', data)

@sio.on("NewButton")
def node_selected(data):
    print("The selected node is: ", data)

@sio.on("SelectedSwitch")
def node_selected(data):
    print("The selected switch is: ", data)

@sio.on("glimpse")
def glimpse(data):
    print("GLIMPSE: " + str(data))
    sio.emit("glimpse", data[1])
    #socketio.emit("update-data", data)

@sio.on("addNode")
def add_node(newNodeData):
    print("New_Node: " + str(newNodeData))
    sio.emit("addNode", newNodeData[1])
    #socketio.emit("add-node", newNodeData)

@sio.on("addEdge")
def add_edge(newEdgeData):
    print("AddEdge: " + str(newEdgeData))
    sio.emit("addEdge", newEdgeData[1])
    #socketio.emit("add-edge", newEdgeData)

@sio.on("deleteNode")
def delete_node(nodeID):
    print("deleteNode: " + str(nodeID))
    sio.emit("deleteNode", nodeID[1])
    #socketio.emit("delete-node", nodeID)

@sio.on("deleteEdge")
def delete_edge(edgeID):
    print("deleteEdge: " + str(edgeID) )
    sio.emit("deleteEdge", edgeID[1])
    #socketio.emit("delete-edge", edgeID)

@sio.on("StreamData")
def stream_data(data):
    print("Received: " + str(data))

# ------------------ Connecting to Socket Server ------------------ #
def main(filepath):
   data = sio.emit('connectToServer', {"data": "Hello from client!!"})

   #update_data = get_update_data(filepath)
   
   #for update_obj in update_data:
   #   sio.emit("glimpse", update_obj)
   #   time.sleep(0.5)
      
   # sio.disconnect()

if __name__ == "__main__":
   # send in the path of the json file with update data
   main(sys.argv[1])
   sio.wait()
