from turtle import width
from pyvis.network import Network
import os
import sys
import pathlib
import glm

def getTitle(attributes):
    titleStr = ""
    for k , v in attributes.items():
        titleStr = titleStr + str(k) + ": " + str(v) + "\n"
    return titleStr

def glm2graph(file_path, hide_edges = False):
    """_summary_
        This method will take a file path containing a IEEE_9500 glm file and its includes files
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
    
    edge_types = ["overhead_line", "switch", "underground_line","series_reactor", "triplex_line", "regulator","transformer"]
    node_types = ["load", "triplex_load", "node", "triplex_node", "meter", "triplex_meter","inverter", "diesel_dg", "substation"]
    
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
                obj_type = obj["name"]
                attr = obj["attributes"]
            
                if obj_type in node_types:
                    node_id = attr["name"]
                    g.add_node(node_id, title = f"Object Type: {obj_type}\n" + getTitle(attr))

            for obj in objects:
                obj_type = obj["name"]
                attr = obj["attributes"]
            
                if obj_type in edge_types:
                    edge_from = attr["from"]
                    edge_to = attr["to"]
                    g.add_edge(edge_from, edge_to, title = f"Object Type: {obj_type}\n" + getTitle(attr))
                elif obj_type in node_types:
                    if obj_type == "capacitor":
                        obj_id = attr["name"]
                        parent = attr["parent"]
                        g.add_edge(parent, obj_id, dashes = True)   
                    elif obj_type == "triplex_meter":
                        obj_id = attr["name"]
                        parent = attr["parent"]
                        g.add_edge(parent, obj_id, dashes = True) 
                    elif obj_type == "triplex_load":
                        obj_id = attr["name"]
                        parent = attr["parent"]
                        g.add_edge(parent, obj_id, dashes = True)
                    
                 
        g.toggle_hide_edges_on_drag(hide_edges)
        g.barnes_hut()
        g.toggle_physics(False)           
        g.show("9500Graph.html")
        
glm2graph("C:\\Users\\mend166\\Desktop\\glm_viz\\data\\9500\\IEEE_9500.glm", hide_edges=True)
                    
                    