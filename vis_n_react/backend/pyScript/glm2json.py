import glm
import json
import os
import time
import sys

# dir_path = './backend/glm_file_upload/'


def glm_to_json(files, dir_path):
    glmJson = {}

    for filename in files:
        glmJson[filename.split(".")[0] + ".json"] = glm.load(dir_path + filename)

    return glmJson

def generate_csv( data ):

    edgeTypes = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"]
    nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg"]
    parent_child_edge_types = ["capacitor", "triplex_meter", "triplex_load", "meter"]

    file = open('./csv/metrics.csv', 'w' )

    models = []
    for values in json.loads(data).values():
        models.append(values)

    for objs in models:
        for obj in objs['objects']:
            obj_type = obj['name'].split(":")[0]
            if obj_type in edgeTypes:
                file.write(",".join( [obj['attributes']['from'], "0", obj['attributes']['to'], "1"]) + "\n")
            elif obj_type in parent_child_edge_types:
                try:
                    file.write( ",".join( [obj['attributes']['name'], "0", obj['attributes']['parent'], "1"] ) + "\n")
                except:
                    pass
            elif obj_type in nodeTypes:
                try:
                    file.write(",".join( [obj['attributes']['name'], "0", obj['attributes']['parent'], "1"] ) + "\n")
                except:
                    pass
    

files = os.listdir( sys.argv[1] )
outputData = json.dumps( glm_to_json(files, sys.argv[1]) )
generate_csv( outputData )

print(outputData)

sys.stdout.flush()