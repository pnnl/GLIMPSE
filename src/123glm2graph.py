from turtle import width
from pyvis.network import Network
import os
import sys
import pathlib
import glm

# path_to_file = "C:\\Users\\mend166\\Desktop\\MainProj\\data\\IEEE-123_Dynamic_fixed.glm"
included_files = []

def getTitle(attributes):
    titleStr = ""
    for k , v in attributes.items():
        titleStr = titleStr + str(k) + ": " + str(v) + "\n"
    return titleStr

def glm2graph(file_path, hide_edges = False):
    """_summary_
    This method will take a file path containing a IEEE_123 glm file and its includes files
    and generate a static html file contating the visualisation of the glm file.

    Args:
        file_path (String): Args should be a path containing a glm file
        with included files aswell.

    Returns:
        html file: The method will generate a html file that will automatically open in 
        a browser displaying the generated graph. 
    """
    
    g = Network(height="100%", width="100%", directed=True, heading="Power Grid Model Visualization",
            bgcolor="white", font_color="black")

    edge_types = ["overhead_line", "switch", "underground_line", "regulator","transformer"]
    node_types = ["load", "node", "meter", "inverter_dyn", "diesel_dg"]

    node_options = {"load": {"color": "#edf2f4", "shape": "circularImage", "image": "/imgs/node.png"},
                    "node": {"color": "#4361ee", "shape": "circularImage", "image": "/imgs/node.png"},
                    "meter": {"color": "#d90429", "shape": "circularImage", "image": "/imgs/meter.jpg"},
                    "inverter_dyn": {"color": "#c8b6ff", "shape": "circularImage", "image": "/imgs/inverter.jpg"},
                    "diesel_dg": {"color": "#fee440", "shape": "circularImage", "image": "/imgs/dieselgen.jpg"}}

    edge_options = {"overhead_line": {"width": 4, "color": "#000000"},
                    "switch": {"width": 4, "color": "#3a0ca3"},
                    "underground_line": {"width": 4, "color": "#FFFF00"},
                    "regulator": {"width": 4, "color": "#ff447d"},
                    "transformer": {"width": 4, "color": "#00FF00"}}
    
    included_files = []
    
    path = file_path.replace("\\", "/") #replace the path's forward slashes with backward slashes for python
    parent_path = pathlib.Path(file_path).parent.resolve() #get parent directory of the file
    
    with open (file_path, "r") as glm_file:
        data = glm.load(glm_file)
        includes = data["includes"]
        objects = data["objects"]

        for k in includes: included_files.append("/" + k["value"])
        
        parent_path = pathlib.Path(file_path).parent.resolve() # get the parent path of the original glm file
        index = 0
        
        for f in included_files:
            file_path = str(parent_path) + f
            
            if os.path.isfile(file_path):
                included_files[index] = file_path
            else:
                print("Include files are not in the same path.")
                exit() #script will end if one or more of the includes files are not in the same path
            index += 1

        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]
            
            if obj_type in node_types:
                obj_full_name = obj["name"]
                
                g.add_node(obj_full_name, color = node_options[obj_type]["color"],
                                          borderWidth = 6,#shadow = True,
                                          shape = node_options[obj_type]["shape"], image = node_options[obj_type]["image"],
                                          title = f"Object Name: {obj_full_name}\n" + getTitle(attr))
                    
        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]
            
            if obj_type in edge_types:
                edge_full_name = obj["name"]
                edge_from = attr["from"]
                edge_to = attr["to"]
                
                g.add_edge(edge_from, edge_to, width = edge_options[obj_type]["width"],
                                               color = edge_options[obj_type]["color"],
                                            # shadow = True,
                                               title = f"Object Name: {edge_full_name}\n" + getTitle(attr))
    
    #read the inverters file first
    with open (included_files[1], "r") as glm_file:
        data = glm.load(glm_file)
        objects = data["objects"]
        
        #Each inverter is connected to a meter
        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]
            
            if obj_type in node_types:
                node_id = attr["name"]

                g.add_node(node_id, color = node_options[obj_type]["color"],# shadow = True,
                                    borderWidth = 6,
                                    shape = node_options[obj_type]["shape"], image = node_options[obj_type]["image"],
                                    title = f"Object Name: {obj_type}\n" + getTitle(attr))
                
        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]    
            
            if obj_type in node_types:
                node_id = attr["name"]
                parent = attr["parent"]
                
                if "load:" + parent in g.get_nodes():
                    g.add_edge("load:" + parent,node_id, dashes = True)
                if "node:" + parent in g.get_nodes():
                    g.add_edge("node:" + parent,node_id, dashes = True)
                if parent in g.get_nodes():
                    g.add_edge(parent,node_id, dashes = True)            
    
    #read the diesels file next
    with open (included_files[0], "r") as glm_file:
        data = glm.load(glm_file)
        objects = data["objects"]
        
        for obj in objects:
            obj_type = obj["name"]
            attr = obj["attributes"]
            
            if obj_type in node_types:
                node_id = attr["name"]
                g.add_node(node_id, color = node_options[obj_type]["color"],# shadow = True,
                                    borderWidth = 6,
                                    shape = node_options[obj_type]["shape"], image = node_options[obj_type]["image"],
                                    title = f"Objects Name: {obj_type}\n" + getTitle(attr))
                
        for obj in objects:
            obj_type = obj["name"]
            attr = obj["attributes"]
            
            if obj_type in node_types:
                node_id = attr["name"]
                parent = attr["parent"]
                
                if "meter:" + parent in g.get_nodes():
                    g.add_edge("meter:" + parent, node_id, dashes = True)
                if "load:" + parent in g.get_nodes():
                    g.add_edge("load:" + parent, node_id, dashes = True)

    # Legend nodes
    x = 1250
    y = -850
    step = 125
    g.add_node(n_id = 999,
               x = x,
               y = -785,
               label = "Legend",
               size = 7,
               fixed = False,
               physics = False,
               shape = "ellipse")
    g.add_node(n_id = 1000,
               x = x,
               y = y + step,
               label = "Load",
               value = 1,
               fixed = False,
               physics = False,
               color = node_options["load"]["color"])
    g.add_node(n_id = 1001,
               x = x,
               y = y + 2 * step,
               label = "Node",
               value = 1,
               fixed = False,
               physics = False,
               color = node_options["node"]["color"])
    g.add_node(n_id = 1002,
               x = x,
               y = y + 3 * step,
               label = "Meter",
               value = 1,
               fixed = False,
               physics = False,
               color = node_options["meter"]["color"])
    g.add_node(n_id = 1003,
               x = x,
               y = y + 4 * step,
               label = "Inverter",
               value = 1,
               fixed = False,
               physics = False,
               color = node_options["inverter_dyn"]["color"])
    g.add_node(n_id = 1004,
               x = 1425,
               y = -550,
               label = "Generator",
               value = 1,
               fixed = False,
               physics = False,
               color = node_options["diesel_dg"]["color"])

    g.add_edge(1000,1001, label = "Overhead Line",
                          physics = False,
                          color = edge_options["overhead_line"]["color"],
                          width = edge_options["overhead_line"]["width"])
    g.add_edge(1001,1002, label = "Underground Line",
                          physics = False,
                          color = edge_options["underground_line"]["color"],
                          width = edge_options["underground_line"]["width"])
    g.add_edge(1002,1003, label = "Switch",
                          physics = False,
                          color = edge_options["switch"]["color"],
                          width = edge_options["switch"]["width"])
    g.add_edge(1003,1004, label = "Regulator",
                          physics = False,
                          color = edge_options["regulator"]["color"],
                          width = edge_options["regulator"]["width"])
    g.add_edge(1004,1000, label = "Transformer",
                          physics = False,
                          color = edge_options["transformer"]["color"],
                          width = edge_options["transformer"]["width"])
    
    # g.set_edge_smooth("dynamic")
    # g.hrepulsion()
    # g.repulsion()
    # g.force_atlas_2based()
    # g.barnes_hut()
    g.toggle_hide_edges_on_drag(hide_edges)
    return g.show("network.html")             

if __name__ == "__main__":
    glm2graph(sys.argv[1],sys.argv[2])

# glm2graph(path_to_file)
