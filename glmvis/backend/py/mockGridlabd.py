import asyncio
import socketio
import json
import random

def gen_rand_data():
   rand_styles = {
      'type': "",
      'id': "",
      "styles": {
         'hidden': False,
         'sizeOperation': "",
         "by": 0
      }
   }

   json_file = open("./mock_Gridlabd_data/data.json")
   data = json.load(json_file)

   rand_object = random.choice(list(data.keys()))
   rand_styles['type'] = rand_object

   if(rand_styles['type'] == 'edges'):
      rand_styles['id'] = random.choice(data[rand_object])
      rand_styles['styles']['hidden'] = bool(random.getrandbits(1))
      rand_styles['styles']['width'] = random.choice([2,5,0.15,10,3])
      return rand_styles
   
   rand_styles['id'] = random.choice(data[rand_object])
   rand_styles['styles']['hidden'] = bool(random.getrandbits(1))
   rand_styles['styles']['sizeOperation'] = random.choice(["subtract", "add"])
   rand_styles['styles']['by'] = random.choice([5,10])

   json_file.close()
   return rand_styles

async def send_message(socket):
   for i in range(0, 100):
      msg = gen_rand_data()
      await socket.emit('message', msg)
      await asyncio.sleep(1) # Sleep for 5 seconds before sending the next message

async def main():
   sio = socketio.AsyncClient()

   @sio.event
   async def connect():
      print('Connected to server')

   @sio.event
   async def disconnect():
      print('Disconnected from server')

   await sio.connect('http://localhost:3500')  # Replace with your socket server URL

   # Start sending messages
   await send_message(sio)

   await sio.wait()

if __name__ == '__main__':
   asyncio.run(main())