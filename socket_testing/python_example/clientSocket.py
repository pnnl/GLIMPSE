import socketio

PORT = 5051
URL = "http://127.0.0.1"

sio = socketio.Client()
sio.connect(f"{URL}:{PORT}")

@sio.on("newNatigConfig")
def newConfig(configObject):
   print(str(configObject))

sio.wait()