import sys
import glm
import os
import json
import re

# getFiles function returns a list of glm files in provided folder path
def getFiles( folderPath ):
    files = [ ]

    for file in os.listdir(folderPath):
        if re.search( ".glm$", file ):
            files.append( file )

    return files

#Convert glm file to python dictionary
def glmToDict( files, fileDir ):
    glmDicts = { }

    for file in files:
        glmDicts[ file.split(".")[ 0 ] + ".json" ] = glm.load( fileDir + file )

    return glmDicts

#Converts glm dict to json
def glm2json( glmDict ):
    glm_json = json.dumps( glmDict, indent = 3 )

    return glm_json


'''
this function will create a csv file named map.csv
that will store <node id>, <x>, <y>
'''
# def createMapping( glmDict ):
#     nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg", "communication_node", "microgrid_node"]
#     map_file = open("./mapping/map.csv", "w")

#     for glmFile in glmDict.values():
#         for obj in glmFile['objects']:

#             object_type = obj[ 'name' ].split(":")[0]

#             if object_type in nodeTypes:
#                 try:
#                     map_file.write(",".join([ obj[ 'attributes' ][ 'name' ], obj[ 'attributes' ][ 'x' ], obj[ 'attributes' ][ 'y' ] ]) + "\n")
#                 except:
#                     break

#creates metrics file
def createMetrics( glmDict ):
    edgeTypes = [ "overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer" ]
    nodeTypes = [ "load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg" ]
    parent_child_edge_types = [ "capacitor", "triplex_meter", "triplex_load", "meter" ]

    file = open( "./csv/metrics.csv", "w" )
    mockData = {
        'edges': [],
        'nodes': []
    }

    # objCounter = {
    #     "load": 0,
    #     "triplex_load": 0,
    #     "capacitor": 0,
    #     "node": 0,
    #     "triplex_node": 0,
    #     "substation": 0,
    #     "meter": 0,
    #     "triplex_meter": 0,
    #     "inverter_dyn": 0,
    #     "inverter": 0,
    #     "diesel_dg": 0
    # }

    # edgeCounter = {
    #     "overhead_line": 0,
    #     "switch": 0, 
    #     "underground_line": 0, 
    #     "series_reactor": 0, 
    #     "triplex_line": 0, 
    #     "regulator": 0,
    #     "transformer": 0
    # }

    for glmFile in glmDict.values():
        for obj in glmFile[ 'objects' ]:

            obj_type = obj[ 'name' ].split(":")[ 0 ]

            if obj_type in edgeTypes:

                file.write( ",".join( [obj[ 'attributes' ][ 'from' ], "0", obj[ 'attributes' ][ 'to' ], "1" ] ) + "\n" )

                edgeID = obj['name'] if ":" in obj['name'] else obj_type + ":" + obj['attributes']['name']

                mockData["edges"].append(edgeID)
                    
            if obj_type in parent_child_edge_types:
                try:
                    file.write( ",".join( [ obj[ 'attributes' ][ 'name' ], "0", obj[ 'attributes' ][ 'parent' ], "1" ] ) + "\n")
                except:
                    pass

            if obj_type in nodeTypes:
                mockData["nodes"].append(obj['attributes']['name'])
                try:
                    file.write(",".join( [ obj[ 'attributes' ][ 'name' ], "0", obj[ 'attributes' ][ 'parent' ], "1" ] ) + "\n")
                except:
                    pass
                
    with open("./mock_Gridlabd_data/data.json", "w") as jsonFile:
        jsonFile.write(json.dumps( mockData, indent = 3 ))

def main():

    folderDir = sys.argv[ 1 ]

    fileNames = getFiles( folderDir )
    glmDict = glmToDict( fileNames, folderDir )

    # removeGlmFiles( folderDir )
    createMetrics( glmDict )
    # createMapping( glmDict )

    # Writing to glm2json_output.json
    with open("./json/glm2json_output.json", "w") as jsonFile:
        jsonFile.write( glm2json( glmDict ) )

    sys.stdout.flush()

if __name__ == "__main__":
    main()