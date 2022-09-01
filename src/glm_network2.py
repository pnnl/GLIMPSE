import glm
from pyvis.network import Network

dynamic_file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"
diesels_file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Diesels_fixed.glm"
inverters_file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Inverters_fixed.glm"

g = Network(height="100%", width="100%", directed=True, heading="Power Grid Model Visualization",
            bgcolor="white", font_color="black")

edge_names = ["overhead_line", "switch", "underground_line", "regulator","transformer"]
node_names = ["load", "node", "meter", "inverter_dyn", "diesel_dg"]

node_options = {"load": {"color": "#ffe169", "shape": "diamond"},
                "node": {"color": "#0353a4", "shape": "dot"},
                "inverter_dyn": {"shape": "star"},
                "diesel_dg": {"shape": "square"}}

edge_options = {"overhead_line": {"width": 4, "color": "black"},
                "switch": {"width": 4, "color": "#f9bec7"},
                "underground_line": {"width": 4, "color": "#FFFF00"},
                "regulator": {"width": 4, "color": "#ff447d"},
                "transformer": {"width": 4, "color": "#00FF00"}}

def getTitle(attributes):
    titlestr = ""
    for k , v in attributes.items():
        titlestr = titlestr + str(k) + ":" + str(v) + "\n"
    return titlestr

#read the glm file and load it to the data variable
with open (dynamic_file, "r") as glm_file:
    data = glm.load(glm_file)
    objects = data["objects"]
    
    for obj in objects:
        obj_type = obj["name"].split(":")[0]
        attr = obj["attributes"]
        
        if obj_type in node_names:
            obj_full_name = obj["name"]
            
            if obj_type == "meter":
                g.add_node(obj_full_name, color = "#ff447d", 
                                          shape = "image", image = "/Users/mend166/Desktop/MainProj/img/meter.jpg",
                                          title = f"Object Name: {obj_full_name}\n"+ getTitle(attr))
            else:
                g.add_node(obj_full_name, color = node_options[obj_type]["color"],
                                          shape= node_options[obj_type]["shape"],
                                          title = f"Object Name: {obj_full_name}\n" + getTitle(attr))
                  
    for obj in objects:
        obj_type = obj["name"].split(":")[0]
        attr = obj["attributes"]
        
        if obj_type in edge_names:
            edge_full_name = obj["name"]
            edge_from = attr["from"]
            edge_to = attr["to"]
               
            g.add_edge(edge_from, edge_to, width = edge_options[obj_type]["width"],
                                           color = edge_options[obj_type]["color"],
                                           title = f"Object Name: {edge_full_name}\n" + getTitle(attr))

with open (inverters_file, "r") as glm_file:
    data = glm.load(glm_file)
    objects = data["objects"]
    
    #Each inverter is connected to a meter
    for obj in objects:
        obj_type = obj["name"].split(":")[0]
        attr = obj["attributes"]
        
        if obj_type in node_names:
            node_id = attr["name"]
            
            if obj_type =="meter":
                g.add_node(node_id, shape = "image", 
                                    image = "/Users/mend166/Desktop/MainProj/img/meter.jpg",
                                    title = f"Object Name: {obj_type}\n"+ getTitle(attr))
            else:
                g.add_node(node_id, shape = node_options[obj_type]["shape"],
                                    title = f"Object Name: {obj_type}\n" + getTitle(attr))
            
    for obj in objects:
        obj_type = obj["name"].split(":")[0]
        attr = obj["attributes"]    
        
        if obj_type in node_names:
            node_id = attr["name"]
            parent = attr["parent"]
            
            if "load:" + parent in g.get_nodes():
                g.add_edge("load:" + parent,node_id, dashes = True)
            if "node:" + parent in g.get_nodes():
                g.add_edge("node:" + parent,node_id, dashes = True)
            if parent in g.get_nodes():
                g.add_edge(parent,node_id, dashes = True)
                
with open (diesels_file, "r") as glm_file:
    data = glm.load(glm_file)
    objects = data["objects"]
    
    for obj in objects:
        obj_type = obj["name"]
        attr = obj["attributes"]
        
        if obj_type in node_names:
            node_id = attr["name"]
            g.add_node(node_id, shape = "square",
                                title = f"Objects Name: {obj_type}\n" + getTitle(attr))
            
    for obj in objects:
        obj_type = obj["name"]
        attr = obj["attributes"]
        
        if obj_type in node_names:
            node_id = attr["name"]
            parent = attr["parent"]
            
            if "meter:" + parent in g.get_nodes():
                g.add_edge("meter:" + parent,node_id, dashes = True)
            if "load:" + parent in g.get_nodes():
                g.add_edge("load:" + parent,node_id, dashes = True)
            
# print(g.num_edges(),g.num_nodes())
# g.show_buttons(True)
# g.show_buttons(filter_ = ['physics'])
g.show("network.html")