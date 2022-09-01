import glm
from pyvis.network import Network

file = "/Users/mend166/Desktop/MainProj/data/IEEE-123_Dynamic_fixed.glm"

g = Network(height="100%", width="100%", directed=True,
heading="IEEE-123_Dynamic_fixed", bgcolor="#023047", font_color="white")

with open (file, "r") as glm_file:
    data = glm.load(glm_file)
    objects = data["objects"]
    
    for obj in objects:
        name = obj["name"]
        attributes = obj["attributes"]
        
        for key in attributes.keys():
            if key == "length":
                phases = attributes["phases"]
                attr_name = attributes["name"]
                from_ = attributes["from"]
                to = attributes["to"]
                length = attributes["length"]
                config = attributes["configuration"]
                
                g.add_node(from_, title = from_)
                g.add_node(to, title = to)
                g.add_edge(from_, to, title = f"Object Name: {name}\n Phases: {phases}\n \
                           Name: {attr_name}\n Length: {length}\n Configuration: {config}")

# for n in g.nodes:
#     print(n)

# g.force_atlas_2based()
g.barnes_hut()
g.show("network.html")