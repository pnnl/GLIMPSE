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
    
    edge_types = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"]
    node_types = ["load", "triplex_load","capacitor", "node", "triplex_node", "substation", "meter", "triplex_meter","inverter", "diesel_dg"]
    
    included_files = []
    
    path = file_path.replace("\\", "/") #replace the path's backward slashes with forward slashes for python
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
        
        count = 0
        
        #gather all nodes from file    
        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]
            
            if obj_type in node_types:
                node_id = attr["name"]
                # print(node_id)
                g.add_node(node_id, title = f"Object Type: {obj_type}\n" + getTitle(attr))
                count +=1
    
    #gather all nodes from included files
    for incl_file in included_files:
            with open (incl_file, "r") as glm_file:
                data = glm.load(glm_file)
                objects = data["objects"]
                
                for obj in objects:
                    obj_type = obj["name"].split(":")[0]
                    attr = obj["attributes"]
                    
                    if obj_type in node_types:
                        node_id = attr["name"]
                        # print(node_id)
                        g.add_node(node_id, title = f"Object Type: {obj_type}\n" + getTitle(attr))
                        count +=1
    print(count)
    #create all edges from the passed file
    with open (path, "r") as glm_file:
        data = glm.load(glm_file)
        includes = data["includes"]
        objects = data["objects"]
        
        for obj in objects:
            obj_type = obj["name"].split(":")[0]
            attr = obj["attributes"]
            if obj_type in edge_types:
                
                print(obj_type)
                edge_from = attr["from"].split(":")[1] if ":" in attr["from"] else attr["from"]
                edge_to = attr["to"].split(":")[1] if ":" in attr["to"] else attr["to"]
                g.add_edge(edge_from, edge_to, title = f"Object Type: {obj_type}\n" + getTitle(attr))
                # print("edge added\n")
            
            #create dashed edges for nodes that dont have edges... just parents   
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
                elif obj_type == "meter":
                    obj_id = attr["name"]
                    parent = attr["parent"]
                    g.add_edge(parent, obj_id, dashes = True)

    #Create all edges from included files. All edges are dashes as these edges are parent - child 
    for incl_file in included_files:
        with open (incl_file,"r") as glm_file:
            data = glm.load(glm_file)
            objects = data["objects"]
            
            for obj in objects:
                obj_type = obj["name"].split(":")[0]
                attr = obj["attributes"]
                
                if obj_type in node_types:
                    node_id = attr["name"]
                    parent = attr["parent"]
                    g.add_edge(parent,node_id, dashes = True)
            
    g.toggle_hide_edges_on_drag(hide_edges)
    print(g.num_edges(), g.num_nodes())
    g.show("9500Graph.html")

# if __name__ == "__main__":
    # glm2graph(sys.argv[1],sys.argv[2])
glm2graph("data\\IEEE-123_Dynamic_fixed.glm", hide_edges=True)