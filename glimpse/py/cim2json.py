from cimgraph.databases import ConnectionParameters
from cimgraph.databases import RDFlibConnection
# from cimgraph.models import BusBranchModel
from cimgraph.models import FeederModel
import sys
import json
import importlib

graphObj = {
   "IEEE123.json": {
      "objects": []
   }
}

def addObject(objType, attributes):
   graphObj['IEEE123.json']['objects'].append({
      "name": objType,
      "attributes": attributes
   })

cim_profile = 'rc4_2021'
cim = importlib.import_module('cimgraph.data_profile.' + cim_profile)

# RDFLib File Reader Connection
params = ConnectionParameters(filename=sys.argv[1] , cim_profile='rc4_2021', iec61970_301=7)
rdf = RDFlibConnection(params)

#mrid 123 is _C1C3E687-6FFD-C753-582B-632A27E28507
#model_mrid = "1783D2A8-1204-4781-A0B4-7A73A2FA6038" #IEEE 118 Bus"
model_mrid = "_C1C3E687-6FFD-C753-582B-632A27E28507" #IEEE 123
container = cim.Feeder(mRID = model_mrid)
network = FeederModel(connection=rdf, container=container, distributed=False)

load_types = ['EnergyConsumer', 'ConformLoad', 'NonConformLoad']
gen_types = ['RotatingMachine', 'SynchronousMachine', 'AsynchronousMachine', 'EnergySource']
cap_types = ['ShuntCompensator', 'LinearShuntCompensator']
inv_types = ['PowerElectronicsConnection']
trans_types = ["PowerTransformer"]
switch_types = ['LoadBreakSwitch']

# dupe_ids = []

for node in network.graph[cim.ConnectivityNode].values():
   addObject("c_node", {"id": node.mRID})
   for terminal in node.Terminals:
      equipment = terminal.ConductingEquipment
      eq_class_type = equipment.__class__.__name__

      # print(eq_class_type)

      if eq_class_type in load_types:
         addObject("load", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         addObject("line", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

      if eq_class_type in gen_types:
         addObject("diesel_dg", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         addObject("line", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

      if eq_class_type in cap_types:
         addObject("capacitor", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         addObject("line", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

      if eq_class_type in inv_types:
         addObject("inverter_dyn", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         addObject("line", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})
      
      if eq_class_type in trans_types: 
         addObject("terminal", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         addObject("transformer", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

      # if eq_class_type in switch_types:
      #    addObject("terminal", {"id": terminal.mRID, "eq_class_type": eq_class_type})
      #    addObject("switch", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

   # print(f"------------end of {node.mRID} terminals------------")

topo_edges = []
for line in network.graph[cim.ACLineSegment].values():
   addObject("terminal", {"id": line.Terminals[0].mRID})
   addObject("terminal", {"id": line.Terminals[1].mRID}) # black

   addObject("overhead_line", {
      "id":f"{line.Terminals[0].mRID}-{line.Terminals[1].mRID}",
      "from": line.Terminals[0].mRID,
      "to": line.Terminals[1].mRID
   })

   addObject("line", {
      "id":f"{line.Terminals[0].mRID}-{line.Terminals[0].ConnectivityNode.mRID}",
      "from": line.Terminals[0].mRID,
      "to": line.Terminals[0].ConnectivityNode.mRID
   })

   addObject("line",{
      "id":f"{line.Terminals[1].mRID}-{line.Terminals[1].ConnectivityNode.mRID}",
      "from": line.Terminals[1].mRID,
      "to": line.Terminals[1].ConnectivityNode.mRID
   })
   
   # topo_edges.append([line.Terminals[0].mRID, line.Terminals[1].mRID])
   
for line in network.graph[cim.PowerTransformer].values() :

   #    addObject("terminal", {"id": line.Terminals[0].mRID})
   #    addObject("terminal", {"id": line.Terminals[1].mRID})

   addObject("transformer", {
      "id":f"{line.Terminals[0].mRID}-{line.Terminals[1].mRID}",
      "from": line.Terminals[0].mRID,
      "to": line.Terminals[1].mRID
   })

   addObject("line", {
      "id":f"{line.Terminals[0].mRID}-{line.Terminals[0].ConnectivityNode.mRID}",
      "from": line.Terminals[0].mRID,
      "to": line.Terminals[0].ConnectivityNode.mRID
   })

   addObject("line",{
      "id":f"{line.Terminals[1].mRID}-{line.Terminals[1].ConnectivityNode.mRID}",
      "from": line.Terminals[1].mRID,
      "to": line.Terminals[1].ConnectivityNode.mRID
   })

cim_switch_types = [
   cim.Breaker, 
   cim.Fuse, 
   cim.Switch, 
   cim.Sectionaliser, 
   cim.LoadBreakSwitch, 
   cim.Disconnector, 
   cim.Recloser
]

for cim_type in cim_switch_types:
   if cim_type in network.graph:
      for line in network.graph[cim_type].values():
            addObject("terminal", {"id": line.Terminals[0].mRID})
            addObject("terminal", {"id": line.Terminals[1].mRID}) # black

            addObject("switch", {
               "id":f"{line.Terminals[0].mRID}-{line.Terminals[1].mRID}",
               "from": line.Terminals[0].mRID,
               "to": line.Terminals[1].mRID
            })

            addObject("line", {
               "id":f"{line.Terminals[0].mRID}-{line.Terminals[0].ConnectivityNode.mRID}",
               "from": line.Terminals[0].mRID,
               "to": line.Terminals[0].ConnectivityNode.mRID
            })

            addObject("line",{
               "id":f"{line.Terminals[1].mRID}-{line.Terminals[1].ConnectivityNode.mRID}",
               "from": line.Terminals[1].mRID,
               "to": line.Terminals[1].ConnectivityNode.mRID
            })

print(json.dumps(graphObj, indent=3))