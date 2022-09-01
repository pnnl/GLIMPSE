import networkx as nx
import matplotlib.pyplot as plt
import glm

file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"

edge_names = ["overhead_line", "switch", "underground_line", "regulator","transformer"]
node_names = ["load", "node", "meter"]

G = nx.DiGraph()

with open (file, "r") as glm_file:
    data = glm.load(glm_file)
    objects = data["objects"]
    
    for obj in objects:
        obj_name = obj["name"].split(":")[0]
        attributes = obj["attributes"]
        
        if obj_name in node_names:
            try:
                node_phases = attributes["phases"]
                node_id = attributes["name"]
                obj_full_name = obj["name"]
                node_flags = attributes["flags"]
                node_voltage_A = attributes["voltage_A"]
                node_voltage_B = attributes["voltage_B"]
                node_voltage_C = attributes["voltage_C"]
                node_nominal_voltage = attributes["nominal_voltage"]
            except KeyError:
                pass
            G.add_node(obj_full_name, title = f"Object Name: {obj_full_name}\n Phases: {node_phases}\nName: {node_id}\n Flags: {node_flags}\n Voltage_A: {node_voltage_A}\n Voltage_B: {node_voltage_B}\nVoltage_C: {node_voltage_C}\n Nominal_Voltage: {node_nominal_voltage}")
            
    for obj in objects:
        obj_name = obj["name"].split(":")[0]
        attributes = obj["attributes"]
        
        if obj_name in edge_names:
            try:
                edge_full_name = obj["name"]
                edge_phases = attributes["phases"]
                # edge_name = attributes["name"]
                edge_from = attributes["from"]
                edge_to = attributes["to"]
                # edge_status = attributes["status"]
                edge_length = attributes["length"]
                edge_config = attributes["configuration"]
            except KeyError:
                pass
            G.add_edge(edge_from, edge_to, title = f"Object Name: {edge_full_name}\n Phases: {edge_phases}\n Lenght: {edge_length}\n Configuration: {edge_config}")
            
nx.draw(G)
plt.show()