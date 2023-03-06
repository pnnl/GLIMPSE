import sys
import glm
import os
import json
import re

# getFiles function returns a list of glm files in provided folder path
def getFiles(folderPath):
    files = []

    for file in os.listdir(folderPath):
        if re.search(".glm$", file):
            files.append(file)

    return files

#Convert glm file to python dictionary
def glmToDict(files, fileDir):
    glmDicts = {}

    for file in files:
        glmDicts[file] = glm.load(fileDir + file)

    return glmDicts

#Converts glm dict to json
def glm2json(glmDict):
    glm_json = json.dumps(glmDict, indent = 3)

    return glm_json

#creates metrics file
def createMetrics(glmDict):
    edgeTypes = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"]
    nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg"]
    parent_child_edge_types = ["capacitor", "triplex_meter", "triplex_load", "meter"]

    file = open("./csv/metrics.csv", "w")

    for glmFile in glmDict.values():
        for obj in glmFile['objects']:

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

def main(folderDir):

    # folderDir = "./backend/glmUploads/"
    fileNames = getFiles(folderDir)
    glmDict = glmToDict(fileNames, folderDir)
    
    #prints out the converted glm files to json
    print(glm2json(glmDict))

    createMetrics(glmDict)


if __name__ == "__main__":
    main(sys.argv[1])
    sys.stdout.flush()