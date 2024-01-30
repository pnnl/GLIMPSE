import cimgraph.data_profile.rc4_2021 as cim
from cimgraph.databases import ConnectionParameters
from cimgraph.databases import RDFlibConnection
from cimgraph.models import FeederModel
import cimgraph.utils as cim_utils
import sys
import json

params = ConnectionParameters(filename=sys.argv[1], cim_profile="rc4_2021", iec61970_301=7)
rdf = RDFlibConnection(params)

model_mRID = "_C1C3E687-6FFD-C753-582B-632A27E28507"
feeder = cim.Feeder(mRID=model_mRID)

network = FeederModel(connection=rdf, container=feeder, distributed=False)

json_file = open(sys.argv[2], "r")
json_data = json.load(json_file)

for node in json_data.nodes:
   cim.Terminal()
# 2 basic terminals and one with a conducting equipment
# one connectivity node with its terminals
# one ACLine segment between the two basic terminals