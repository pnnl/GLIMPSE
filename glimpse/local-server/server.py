from flask import Flask, request as req
from engineio.async_drivers import gevent
from flask_socketio import SocketIO
from uuid import uuid4
import networkx as nx
import random as rand
import glm
import ntpath
import json

# return the file name only
def path_leaf(path: str):
   head, tail = ntpath.split(path)
   return tail or ntpath.basename(head)

#Convert glm file to python dictionary
def glm_to_dict( file_paths: list ):
   glm_dicts = {}

   for path in file_paths:
      glm_dicts[ path_leaf(path).split(".")[0] + ".json" ] = glm.load(path)

   return glm_dicts

#Converts glm dict to json
def dict2json( glm_dict: dict ):
   glm_json = json.dumps( glm_dict, indent = 3 )
   return glm_json

def get_nx_graph(file_data: dict):
   graph = nx.MultiGraph()

   for obj in file_data["objects"]:
      if obj["elementType"] == "node":
         graph.add_node(obj["attributes"]["id"], objectType = obj["objectType"], attributes = obj["attributes"])
      else:
         graph.add_edge(obj["attributes"]["from"], obj["attributes"]["to"], obj["attributes"]["id"])
                        
   return graph

def get_modularity(graph: nx.MultiGraph):
   modularity = nx.community.modularity(graph, nx.community.label_propagation_communities(graph))
   return modularity

def get_avg_betweenness_centrality(graph):
   avg = 0
   myk = int(graph.number_of_nodes()*0.68)
   betweenness_centrality_dict = nx.betweenness_centrality(graph, k=myk)
   
   for centrality in betweenness_centrality_dict.values():
      avg += centrality

   return avg/len(betweenness_centrality_dict)

def cim2json(filepath: str):
   from cimgraph.databases import ConnectionParameters
   from cimgraph.databases import RDFlibConnection
   import cimgraph.data_profile.rc4_2021 as cim
   from cimgraph.models.feeder_model import FeederModel
   import json

   graphObj = {
      f"{filepath}": {
         "objects": []
      }
   }

   def addObject(objType, attributes):
      graphObj[filepath]['objects'].append({
         "name": objType,
         "attributes": attributes
      })

   # RDFLib File Reader Connection
   params = ConnectionParameters(filename=filepath , cim_profile='rc4_2021', iec61970_301=7)
   rdf = RDFlibConnection(params)

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

   # network.pprint(cim.ConnectivityNode)

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
         
         # if eq_class_type in trans_types: 
         #    addObject("terminal", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         #    addObject("transformer", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

         # if eq_class_type in switch_types:
         #    addObject("terminal", {"id": terminal.mRID, "eq_class_type": eq_class_type})
         #    addObject("switch", {"id": f"{node.mRID}-{terminal.mRID}", "from": node.mRID, "to": terminal.mRID})

      # print(f"------------end of {node.mRID} terminals------------")

   topo_edges = []

   network.get_all_edges(cim.ACLineSegment)
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
   network.get_all_edges(cim.PowerTransformer)
   network.get_all_edges(cim.PowerTransformerEnd)
   network.get_all_edges(cim.TransformerTank)
   network.get_all_edges(cim.TransformerTankEnd)
      
   for line in network.graph[cim.TransformerTank].values():
      addObject("terminal", {"id": line.TransformerTankEnds[0].Terminal.mRID})
      addObject("terminal", {"id": line.TransformerTankEnds[1].Terminal.mRID})

      addObject("transformer", {
         "id":f"{line.TransformerTankEnds[0].Terminal.mRID}-{line.TransformerTankEnds[1].Terminal.mRID}",
         "from": line.TransformerTankEnds[0].Terminal.mRID,
         "to": line.TransformerTankEnds[1].Terminal.mRID
      })

      addObject("line", {
         "id":f"{line.TransformerTankEnds[0].Terminal.mRID}-{line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID}",
         "from": line.TransformerTankEnds[0].Terminal.mRID,
         "to": line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID
      })

      addObject("line",{
         "id":f"{line.TransformerTankEnds[1].Terminal.mRID}-{line.TransformerTankEnds[1].Terminal.ConnectivityNode.mRID}",
         "from": line.TransformerTankEnds[1].Terminal.mRID,
         "to": line.TransformerTankEnds[0].Terminal.ConnectivityNode.mRID
      })
   
   for line in network.graph[cim.PowerTransformer].values():
      if line.PowerTransformerEnd:
         addObject("terminal", {"id": line.PowerTransformerEnd[0].Terminal.mRID})
         addObject("terminal", {"id": line.PowerTransformerEnd[1].Terminal.mRID})

         addObject("transformer", {
            "id":f"{line.PowerTransformerEnd[0].Terminal.mRID}-{line.PowerTransformerEnd[1].Terminal.mRID}",
            "from": line.PowerTransformerEnd[0].Terminal.mRID,
            "to": line.PowerTransformerEnd[1].Terminal.mRID
         })

         addObject("line", {
            "id":f"{line.PowerTransformerEnd[0].Terminal.mRID}-{line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID}",
            "from": line.PowerTransformerEnd[0].Terminal.mRID,
            "to": line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID
         })

         addObject("line",{
            "id":f"{line.PowerTransformerEnd[1].Terminal.mRID}-{line.PowerTransformerEnd[1].Terminal.ConnectivityNode.mRID}",
            "from": line.PowerTransformerEnd[1].Terminal.mRID,
            "to": line.PowerTransformerEnd[0].Terminal.ConnectivityNode.mRID
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
   return json.dumps(graphObj)

def add_to_cim(dir2save: str, data):
   from cimgraph.databases import ConnectionParameters
   from cimgraph.databases import RDFlibConnection
   import cimgraph.utils as cim_utils
   import cimgraph.data_profile.rc4_2021 as cim
   from cimgraph.models import FeederModel

   # RDFLib File Reader Connection
   params = ConnectionParameters(filename=data["filename"] , cim_profile='rc4_2021', iec61970_301=7)
   rdf = RDFlibConnection(params)
   
   model_mrid = "_C1C3E687-6FFD-C753-582B-632A27E28507" #IEEE 123
   feeder = cim.Feeder(mRID = model_mrid)
   network = FeederModel(connection=rdf, container=feeder, distributed=False)
    
   for nodes in data["objs"]:
      c_node = cim.ConnectivityNode(mRID=f"_{nodes[1]['mRID'].upper()}", name=nodes[1]['name'])
      c_node.ConnectivityNodeContainer = feeder
      new_terminal = cim.Terminal(mRID=f"_{nodes[0]['mRID'].upper()}", name=nodes[0]['name'])
      terminal_1 = cim.Terminal(mRID=f"_{nodes[2]['mRID'].upper()}", name=nodes[2]['name'])
      terminal_2 = cim.Terminal(mRID=f"_{nodes[3]['mRID'].upper()}", name=nodes[3]['name'])
      ACLine = cim.ACLineSegment(mRID=f"_{str(uuid4()).upper()}", name=f"l:{nodes[4]['id'].split(':')[1]}")
      ACLine.EquipmentContainer = feeder
      parent_c_node = network.graph[cim.ConnectivityNode][nodes[3]['parent']]
      
      new_terminal.ConnectivityNode = c_node
      terminal_1.ConnectivityNode = c_node
      terminal_2.ConnectivityNode = parent_c_node
      
      terminal_1.ConductingEquipment = ACLine
      terminal_2.ConductingEquipment = ACLine
      
      if nodes[0]['group'] == "diesel_dg":
         energy_source = cim.EnergySource(mRID=f"_{str(uuid4()).upper()}", name=f"source:{rand.randint(1,999)}")
         new_terminal.ConductingEquipment = energy_source
      if nodes[0]['group'] == "load":
         energy_consumer = cim.EnergyConsumer(mRID=f"_{str(uuid4()).upper()}", name=f"consumer:{rand.randint(1,999)}")
         new_terminal.ConductingEquipment = energy_consumer
         
      # c_node.Terminals = [new_terminal, terminal_1]
      
   network.add_to_graph(new_terminal)
   network.add_to_graph(ACLine)
   network.add_to_graph(terminal_1)
   network.add_to_graph(terminal_2)
   network.add_to_graph(c_node)
   
   cim_utils.get_all_data(network)
   cim_utils.write_xml(network, dir2save + "\\cim_output.xml")
        
#------------------------------ Server ------------------------------#
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")

@app.route("/")
def api():
   return {"api": "GLIMPSE flask backend"}

@app.route("/glm2json", methods=["POST"])
def glm_to_json():
   paths = req.get_json()
   glm_dict = glm_to_dict(paths)
   
   return dict2json(glm_dict)

@app.route("/getstats", methods=["POST"])
def get_stats():
   data = req.get_json()
   graph = get_nx_graph(data)
   
   summary_stats = {
      '#Nodes': graph.number_of_nodes(),
      '#Edges': graph.number_of_edges(),
      '#ConnectedComponets': nx.number_connected_components(graph),
      'modularity': get_modularity(graph),
      'avgBetweennessCentrality': get_avg_betweenness_centrality(graph)
   }
   
   return summary_stats

@app.route("/add2cim", methods=["POST"])
def add2cim():
   new_cim_data = req.get_json()
   add_to_cim(dir2save=new_cim_data["savepath"], data=json.loads(new_cim_data["data"]))

   return '', 204

@app.route("/getcim", methods=["POST"])
def getCIM():
   paths = req.get_json()
   output_data = cim2json(paths[0])

   return output_data

@socketio.on("glimpse")
def glimpse(data):
   socketio.emit("update-data", json.dumps(data))
   
if __name__=="__main__":
   socketio.run(app, debug=True, log_output=True)