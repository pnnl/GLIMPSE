import pandas as pd
import json
import re

xls = pd.ExcelFile("./backend/data/9500/Topology.xlsx")
df = pd.read_excel(xls, "NS3-Gridlabd")
df = df.iloc[116:151, 1]
# print(df)

objects = []
for obj in list(df):
   objects.append(re.sub('[",]',"",obj))

with open("./backend/data/topology.json", "r") as topology:
   data = json.load(topology)

   for obj in objects:
      data['objects'].append({
         'name': 'mapping',
         'attributes': {
            'name': 'SS-' + obj.split('_')[1],
            'from': 'SS',
            'to': obj.split('_')[0] + ':' + obj.split('_')[1]
            }
         })

with open("./backend/data/topology.json", "w") as topology:
   topology.write(json.dumps(data, indent=3))

# with open("./backend/data/topology.json", "r") as topology:
#    data = json.load(topology)

#    for obj in data["objects"]:
#       obj['children'] = []
   
# with open("./backend/data/topology.json", "w") as topology:
#    topology.write(json.dumps(data, indent = 3))