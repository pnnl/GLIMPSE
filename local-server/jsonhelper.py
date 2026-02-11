import jsonschema
import json
import os

class JSONHelper:
   def __init__(self):
      pass
   
   def validate_json_data(self, json_data: dict) -> dict:
      # Load the JSON schema
      schema_path = os.path.join(os.path.dirname(__file__), 'schemas', 'json_upload.schema.json')
      with open(schema_path, 'r') as f:
         json_schema = json.load(f)
      
      data = {}
      node_link_data_keys = ["directed", "multigraph", "graph", "nodes", "edges"]
      
      for file_path, file_data in json_data.items():
         # Check if data is in node-link format
         if all(key in file_data for key in node_link_data_keys):
            # Transform node-link data to GLIMPSE format
            data[file_path] = {"objects": []}
            
            # Process nodes
            for node in file_data.get("nodes", []):
               object_type = None
               
               if "type" in node and isinstance(node["type"], dict):
                  object_type = "-".join(node["type"].get("path", []))
               elif "type" in node:
                  object_type = node["type"]
               else:
                  object_type = "node"
               
               data[file_path]["objects"].append({
                  "objectType": object_type,
                  "elementType": "node",
                  "attributes": node
               })
            
            # Process edges
            for edge in file_data.get("edges", []):
               source = edge["source"]
               target = edge["target"]
               key = edge["key"]
               edge_id = f"{source}-{target}-{key}"
               print("Processing edge: " + edge_id)
               
               new_edge = {
                  "objectType": edge.get("type", "edge"),
                  "elementType": "edge",
                  "attributes": {
                     "id": edge_id,
                     "from": source,
                     "to": target
                  }
               }

               for key, val in edge.items():
                  if key not in ["source", "target", "key"]:
                     new_edge["attributes"][key] = val
               
               data[file_path]["objects"].append(new_edge)
         else:
            # Validate against JSON schema
            try:
               jsonschema.validate(instance=file_data, schema=json_schema)
               data[file_path] = file_data
            except jsonschema.ValidationError as e:
               raise ValueError(f"JSON validation error for {file_path}: {e.message}")
      
      return data