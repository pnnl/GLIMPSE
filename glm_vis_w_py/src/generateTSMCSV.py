import glm
import pandas as pd

dynamic_objs = glm.load('./data/IEEE-123_Dynamic_fixed.glm')['objects']
edge_types = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"]

f = open('IEEE-123_Dynamic_fixed.csv', 'w')

for obj in dynamic_objs:
    obj_type = obj["name"].split(":")[0]
    if obj_type in edge_types:
        f.write(",".join([obj['attributes']['from'].split(":")[1], "0", obj['attributes']['to'].split(":")[1], "1"]) + "\n")

f.close()