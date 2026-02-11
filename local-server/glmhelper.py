import glm
import os

class GLMHelper:
   def __init__(self):
      pass
       
   def parse_glm(self, file_paths: list) -> dict:
      glm_dicts = {}
      
      for glm_path in file_paths:
         glm_dicts[os.path.basename(glm_path).split(".")[0] + ".json"] = glm.load(glm_path)

      return glm_dicts

   def json_to_glm(self, json_str: dict): 
      data = json_str["data"]
      save_dir = json_str["saveDir"]

      for filename in data.keys():
         with open(os.path.join(save_dir, filename), "w") as glm_file:
            glm.dump(data[filename], glm_file)
            glm_file.close()