import glm
import json
import os
import time
import sys

def glm_to_json(files, dir_path):
    glmJson = {}

    for filename in files:
        glmJson[filename.split(".")[0] + ".json"] = glm.load(dir_path + filename)

    return glmJson

# dir_path = './backend/glm_file_upload/'

files = os.listdir(sys.argv[1])
outputData = glm_to_json(files, sys.argv[1])

# outputFile = open("./json/outputData.json", "w")
# outputFile.write(json.dumps(outputData, indent=3))
# outputFile.close()

# print('./json/outputData.json')
print(json.dumps(outputData))