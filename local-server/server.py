import os
import json
import tempfile
import traceback

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import shutil

from cimhelper import CIMHelper
from glmhelper import GLMHelper
from jsonhelper import JSONHelper
from gridappsdhelper import GridAPPSDHelper

cim_helper = CIMHelper()
glm_helper = GLMHelper()
json_helper = JSONHelper()
gridappsd_helper = GridAPPSDHelper()

# ================================================================================================
# FLASK APP SETUP
# ================================================================================================
cors_origins = [
   "http://localhost:5173",
   "http://localhost:3000",
   "http://localhost:4173",
   "http://127.0.0.1:5173",
   "http://127.0.0.1:4173",
   "http://127.0.0.1:3000",
   "http://localhost:61613",
   "http://127.0.0.1:61613",
   "http://127.0.0.1:8889",
   "http://localhost:8889",
   "http://localhost:8889/bigdata/namespace/kb/sparql"
]

methods = ["GET", "POST", "DELETE", "OPTIONS"]
allowed_headers = ["Content-Type", "Authorization"]

app = Flask(__name__)
CORS(
   app, 
   origins=cors_origins,
   methods=methods,
   allow_headers=allowed_headers,
   supports_credentials=True
)
socketio = SocketIO(app, async_mode="threading")

# ================================================================================================
# CIM OBJECT MANAGEMENT ENDPOINTS
# ================================================================================================

@app.route('/api/objects/<uuid>', methods=['GET'])
def get_object(uuid):
   try:
      
      res = cim_helper.get_cim_object(uuid)

      if "error" in res:
         return res, 404
      return res, 200

   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return jsonify({'error': str(e), 'traceback': tb}), 500

@app.route('/api/objects/<uuid>', methods=['DELETE'])
def delete_object(uuid):
   try:

      if cim_helper.delete_cim_object(uuid):
         return jsonify({
            'success': True,
            'uuid': uuid,
            'message': 'Object deleted successfully'
         })
      else: 
         return jsonify({'error': f'Failed to delete object {uuid}'}), 400

   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return jsonify({'error': str(e), 'traceback': tb}), 500

@app.route('/api/objects/<uuid>/mermaid', methods=['GET'])
def get_object_mermaid(uuid):
   try:
      res = cim_helper.get_mermaid(uuid)
      return res, 200
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return jsonify({'error': str(e), 'traceback': tb}), 500

# ================================================================================================
# JSON CONVERSION 
# ================================================================================================

@app.route("/api/upload/json", methods=["POST"])
def upload_json():
      """
      This endpoint receives one or more JSON files via multipart/form-data,
      validates them against the schema, and returns the transformed data.
      """
      # Validate presence of 'files' in form-data
      if "files" not in request.files:
         return {"error": "No 'files' part in the form data."}, 400
   
      files = request.files.getlist("files")
      if not files:
         return {"error": "No files uploaded."}, 400
   
      tmpdir = tempfile.mkdtemp(prefix="json_upload_")
      paths = []
   
      try:
         # Save uploaded files
         for f in files:
            if not f or f.filename == "":
               continue
            filename = secure_filename(f.filename)
            dest_path = os.path.join(tmpdir, filename)
            f.save(dest_path)
            paths.append(dest_path)
   
         if not paths:
            return {"error": "No valid files received."}, 400
   
         # Read JSON files
         json_dict = {}
         for path in paths:
            with open(path, 'r') as json_file:
               json_dict[os.path.basename(path)] = json.load(json_file)
         
         # Validate and transform JSON data
         try:
            validated_data = json_helper.validate_json_data(json_dict)
            return json.dumps(validated_data)
         except ValueError as e:
            tb = traceback.format_exc()
            print(tb)
            return {"error": str(e), "traceback": tb}, 400
   
      except Exception as e:
         tb = traceback.format_exc()
         print(tb)
         return {"error": f"Server error: {str(e)}", "traceback": tb}, 500
      finally:
         # Clean up temp files/dir
         shutil.rmtree(tmpdir, ignore_errors=True)

# ================================================================================================
# GLM CONVERSION ENDPOINTS 
# ================================================================================================

@app.route("/api/upload/glm", methods=["POST"])
def upload_glm_to_json():
   """
   This endpoint receives one or more .glm files via multipart/form-data,
   saves them to a temp directory, collects their paths, and converts to JSON.
   """
   # Validate presence of 'files' in form-data
   if "files" not in request.files:
      return {"error": "No 'files' part in the form data."}, 400

   files = request.files.getlist("files")
   if not files:
      return {"error": "No files uploaded."}, 400

   tmpdir = tempfile.mkdtemp(prefix="glm_upload_")
   paths = []

   try:
      for f in files:

         if not f or f.filename == "":
            continue

         filename = secure_filename(f.filename)
         dest_path = os.path.join(tmpdir, filename)
         f.save(dest_path)
         paths.append(dest_path)

      if not paths:
         return {"error": "No valid files received."}, 400

      glm_dict = glm_helper.parse_glm(paths) # expects list of paths
      return json.dumps(glm_dict)
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return {"error": f"Server error: {str(e)}", "traceback": tb}, 500
   finally:
      # Clean up temp files/dir
      shutil.rmtree(tmpdir, ignore_errors=True)

@app.route("/api/parse/json-to-glm", methods=["POST"])
def json_to_glm():
   try: 
      if request.is_json:
         req_data = request.get_json()
         glm_helper.json_to_glm(req_data) 
         
         return "", 204
      else:
         return {"error": "Request must be JSON"}, 400
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return {"error": f"Server error: {str(e)}", "traceback": tb}, 500

# ================================================================================================
# CIM OBJECT UPDATE ENDPOINT 
# ================================================================================================

@app.route("/api/upload/cim", methods=["POST"])
def cim_to_glimpse():
   # Validate presence of 'files' in form-data
   if "files" not in request.files:
      return {"error": "No 'files' part in the form data."}, 400

   files = request.files.getlist("files")
   if not files:
      return {"error": "No files uploaded."}, 400

   tmpdir = tempfile.mkdtemp(prefix="cim_upload_")
   paths = []

   try:
      for f in files:
         if not f or f.filename == "":
            continue
         filename = secure_filename(f.filename)
         dest_path = os.path.join(tmpdir, filename)
         f.save(dest_path)
         paths.append(dest_path)

      if not paths:
         return {"error": "No valid files received."}, 400

      glimpse_structure_data = cim_helper.cim_to_gjs(filepaths=paths)
      return glimpse_structure_data

   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return {"error": f"Server error: {str(e)}", "traceback": tb}, 500
   finally:
      # Cleanup
      shutil.rmtree(tmpdir, ignore_errors=True)

@app.route("/api/export/export-cim", methods=["POST"])
def export_cim_file():
  cim_data = request.get_json()

  export_dir = cim_data["savepath"]
  print(export_dir)
  data = cim_data["objs"]
  og_filepath = cim_data["filename"]

  cim_helper.export_cim(export_dir, og_filepath, data)
  return "", 204

@app.route("/api/export/export-cim-coordinates", methods=["POST"])
def export_cim_():
   """
   This endpoint exports the new coordinates of the nodes to the CIM file
   """
   cim_data = request.get_json()
   new_coords_obj = cim_data["data"]
   output_path = cim_data["filepath"]

   try:
      cim_helper.export_cim_coords(new_coords_obj, output_path)
   except Exception as e:
      print(f"Error exporting CIM coordinates: {e}")
      return {"error": str(e)}, 500
   return "", 204

# ================================================================================================
# GridAPPS-D INTERACTION ENDPOINTS 
# ================================================================================================
@app.route("/api/gridappsd/models", methods=["POST"])
def get_models():
   req_data = request.get_json() 

   print(f"\nModel IDs Received:\n{req_data}\n")

   try:
      gjs = cim_helper.cim_to_gjs(model_IDs=req_data) 
      return gjs, 200
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return json.dumps({"error": str(e), "traceback": tb}), 500

@app.route("/api/gridappsd/model-info", methods=["GET"])
def get_gridappsd_models():
   try:
      if not gridappsd_helper.is_connected():
         return json.dumps({'error': 'Not connected to GridAPPS-D'}), 500

      models = gridappsd_helper.get_models()
      return json.dumps(models), 200
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return json.dumps({'error': str(e), 'traceback': tb}), 500

@app.route("/api/gridappsd/status", methods=["GET"])
def get_gridappsd_status():
   try:
      status = gridappsd_helper.is_connected()
      print(status)
      
      return json.dumps({
         'connected': status,
         'message': 'Connected to GridAPPS-D' if status else 'Not connected to GridAPPS-D'
      }), 200
      
   except Exception as e:
      tb = traceback.format_exc()
      print(tb)
      return json.dumps({
         'connected': False,
         'error': str(e),
         'traceback': tb
      }), 200  # Return 200 so React app can handle the response

# ================================================================================================
# WEBSOCKET EVENTS 
# ================================================================================================

@socketio.on("glimpse")
def glimpse(data):
   socketio.emit("update-data", data)

@socketio.on("addNode")
def add_node(new_node_data):
   socketio.emit("add-node", new_node_data)

@socketio.on("addEdge")
def add_edge(new_edge_data):
   socketio.emit("add-edge", new_edge_data)

@socketio.on("deleteNode")
def delete_node(node_id):
   socketio.emit("delete-node", node_id)

@socketio.on("deleteEdge")
def delete_edge(edge_id):
   socketio.emit("delete-edge", edge_id)

# ================================================================================================
# HEALTH CHECK AND BASIC ENDPOINTS
# ================================================================================================

@app.route("/")
def hello():
   """Basic API information endpoint"""
   return {"api": "GLIMPSE CIM-Graph Flask Backend", "version": "0.7.0-alpha"}

# ================================================================================================
# MAIN APPLICATION ENTRY POINT
# ================================================================================================

if __name__ == "__main__":
   # Start the Flask-SocketIO server
   port = int(os.environ.get('FLASK_PORT', 5051))
   socketio.run(app, host='127.0.0.1', port=port, debug=True, log_output=True)
