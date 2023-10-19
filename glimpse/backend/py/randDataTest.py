import random
import json

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
   rand_styles['id'] = random.choice(data[rand_object])
   rand_styles['styles']['hidden'] = bool(random.getrandbits(1))
   rand_styles['styles']['sizeOperation'] = random.choice(["subtract", "add"])
   rand_styles['styles']['by'] = random.choice([5,10])

   json_file.close()
   return rand_styles

styles = gen_rand_data()
print(styles)