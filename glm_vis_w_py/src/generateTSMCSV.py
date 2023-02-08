import glm
import pandas as pd

IEEE_9500 = glm.load('./data/9500/IEEE_9500.glm')['objects']
IEEE_9500_INV = glm.load('./data/9500/Inverters.glm')['objects']
IEEE_9500_GEN = glm.load('./data/9500/Rotating_Machines2.glm')['objects']

# dynamic_objs = glm.load('./data/IEEE-123_Dynamic_fixed.glm')['objects']
# inverter_objs = glm.load("./data/IEEE-123_Inverters_fixed.glm")['objects']
# generator_objs = glm.load('./data/IEEE-123_Diesels_fixed.glm')['objects']

# power_grid_model = [dynamic_objs, inverter_objs, generator_objs]
power_grid_model = [IEEE_9500, IEEE_9500_INV, IEEE_9500_GEN]

edgeTypes = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"]
nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg"]
parent_child_edge_types = ["capacitor", "triplex_meter", "triplex_load", "meter"]

# f = open('123Model.csv', 'w')
f = open('9500Model.csv', 'w')

for objects in power_grid_model:
    for obj in objects:
        obj_type = obj['name'].split(":")[0]
        if obj_type in edgeTypes:
            f.write(",".join( [obj['attributes']['from'], "0", obj['attributes']['to'], "1"]) + "\n")
        elif obj_type in parent_child_edge_types:
            try:
                f.write( ",".join( [obj['attributes']['name'], "0", obj['attributes']['parent'], "1"] ) + "\n")
            except:
                pass
        elif obj_type in nodeTypes:
            try:
                f.write(",".join( [obj['attributes']['name'], "0", obj['attributes']['parent'], "1"] ) + "\n")
            except:
                pass
        
f.close()