import os
import json
import tempfile
import traceback
import gc
import time


from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename
import shutil

from cimhelper import CIMHelper
from glmhelper import GLMHelper
from jsonhelper import JSONHelper
from gridappsdhelper import GridAPPSDHelper

# ================================================================================================
# HELPERS
# ================================================================================================

json_helper = JSONHelper()
glm_helper = GLMHelper()
cim_helper = CIMHelper()
gridappsd_helper = GridAPPSDHelper()

# ================================================================================================
# FLASK APP SETUP
# ================================================================================================
cors_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "http://localhost:61613",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:61613",
]

methods = ["GET", "POST", "DELETE", "OPTIONS"]
allowed_headers = ["Content-Type", "Authorization"]

app = Flask(__name__)
CORS(
    app,
    origins=cors_origins,
    methods=methods,
    allow_headers=allowed_headers,
    supports_credentials=True,
)
socketio = SocketIO(
    app, async_mode="gevent", cors_allowed_origins=cors_origins, allow_upgrades=True
)

# ================================================================================================
# CIM OBJECT MANAGEMENT ENDPOINTS
# ================================================================================================


@app.route("/api/cim/objects", methods=["POST"])
def get_object():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.get_json()
        feeder_id = data.get("feeder_id")
        mRID = data.get("mRID")

        if not feeder_id or not mRID:
            return jsonify({"error": "Both 'feeder_id' and 'mRID' are required"}), 400

        res = cim_helper.get_cim_object(feeder_id, mRID)

        if "error" in res:
            return res, 404
        return res, 200

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return jsonify({"error": str(e), "traceback": tb}), 500


@app.route("/api/cim/objects", methods=["DELETE"])
def delete_object():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.get_json()
        feeder_id = data.get("feeder_id")
        mRID = data.get("mRID")

        if not feeder_id or not mRID:
            return jsonify({"error": "Both 'feeder_id' and 'mRID' are required"}), 400

        if cim_helper.delete_cim_object(feeder_id, mRID):
            return jsonify(
                {
                    "success": True,
                    "feeder_id": feeder_id,
                    "mRID": mRID,
                    "message": "Object deleted successfully",
                }
            )
        else:
            return (
                jsonify(
                    {"error": f"Failed to delete object {mRID} in feeder {feeder_id}"}
                ),
                400,
            )

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return jsonify({"error": str(e), "traceback": tb}), 500


@app.route("/api/cim/objects/mermaid", methods=["POST"])
def get_object_mermaid():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400

        data = request.get_json()
        print(data)
        feeder_id = data.get("feeder_id")
        mRID = data.get("mRID")

        if not feeder_id or not mRID:
            return jsonify({"error": "Both 'feeder_id' and 'mRID' are required"}), 400

        res = cim_helper.get_mermaid(feeder_id, mRID)
        return res, 200

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return jsonify({"error": str(e), "traceback": tb}), 500


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

        # Filter out theme files from paths and store separately
        theme_filename = json_helper.get_theme_filename(paths)

        themeData = None
        if theme_filename:
            themeData = json_helper.validate_json_theme(theme_filename)

        # Read JSON files
        json_dict = {}
        for path in paths:
            if path == theme_filename:
                continue
            with open(path, "r") as json_file:
                json_dict[os.path.basename(path)] = json.load(json_file)

        # Validate and transform JSON data
        try:
            validated_data = json_helper.validate_json_data(json_dict)
            # themeData is already None to begin with if there was no theme file in the paths
            response_data = {"data": validated_data, "themeData": themeData}
            return json.dumps(response_data)
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
def glm_upload():
    """
    This endpoint receives one or more .glm files via multipart/form-data,
    saves them to a temp directory, collects their paths, and converts to JSON.
    """
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

        print("\n" + "=" * 30)
        print(f"Received files: {paths}")
        print("=" * 30)

        theme_filename = json_helper.get_theme_filename(paths)
        themeData = None
        if theme_filename:
            themeData = json_helper.validate_json_theme(theme_filename)

        filtered_paths = [p for p in paths if p != theme_filename]

        print(f"[SERVER] Processing {len(filtered_paths)} GLM files...")
        glm_dict = glm_helper.parse_glm(filtered_paths)  # expects list of paths
        print(f"[SERVER] GLM parsing completed successfully")

        # Serialize response data BEFORE cleanup to ensure no dangling references
        response = json.dumps({"data": glm_dict, "themeData": themeData})
        return response
    except RuntimeError as re:
        # Handle module reset failures
        print(f"[SERVER] CRITICAL: {str(re)}")
        return {"error": f"GLM module error (may need backend restart): {str(re)}"}, 500
    except ValueError as ve:
        # Handle validation errors (e.g., file too large)
        print(f"[SERVER] Validation error: {str(ve)}")
        return {"error": str(ve)}, 400
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return {"error": f"Server error: {str(e)}", "traceback": tb}, 500
    finally:
        try:
            print("[SERVER] Running cleanup and garbage collection...")
            gc.collect()  # Force garbage collection
            time.sleep(0.5)  # Allow extra time for file handles to release
            shutil.rmtree(tmpdir, ignore_errors=True)
            print("[SERVER] Cleanup completed")
        except Exception as cleanup_error:
            print(f"Warning: Failed to clean up temp directory: {cleanup_error}")

@app.route("/api/export/glm", methods=["POST"])
def export_glm():
    """
    Receives JSON graph data, converts to GLM files,
    and returns them as a zip archive for download.
    """
    json_data = request.get_json()

    if not json_data or "data" not in json_data:
        return {"error": "No data provided."}, 400

    data = json_data["data"]
    tmpdir = tempfile.mkdtemp(prefix="glm_export_")

    try:

        zip_buffer = glm_helper.json_to_glm(data, tmpdir)

        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="exported_model.zip"
        )

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return {"error": f"Export failed: {str(e)}", "traceback": tb}, 500

    finally:
        # Clean up temp directory
        shutil.rmtree(tmpdir, ignore_errors=True)

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
        if gridappsd_helper is None:
            return json.dumps({"error": "GridAPPS-D helper not initialized"}), 503

        gjs = cim_helper.cim_to_gjs(model_IDs=req_data)

        return gjs, 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return json.dumps({"error": str(e), "traceback": tb}), 500


@app.route("/api/gridappsd/model-info", methods=["GET"])
def get_gridappsd_models():
    try:
        if gridappsd_helper is None:
            return json.dumps({"error": "GridAPPS-D helper not initialized"}), 503

        if not gridappsd_helper.is_connected():
            return json.dumps({"error": "Not connected to GridAPPS-D"}), 503

        models = gridappsd_helper.get_models()
        return json.dumps(models), 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return json.dumps({"error": str(e), "traceback": tb}), 503


@app.route("/api/gridappsd/status", methods=["GET"])
def get_gridappsd_status():
    try:

        connected = gridappsd_helper.try_connect()

        return (
            json.dumps(
                {
                    "connected": connected,
                    "message": (
                        "Connected to GridAPPS-D"
                        if connected
                        else "Not connected to GridAPPS-D"
                    ),
                }
            ),
            200,
        )

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return (
            json.dumps({"connected": False, "error": str(e), "traceback": tb}),
            200,
        )  # Return 200 so React app can handle the response


# ================================================================================================
# GLIMPSE WEBSOCKET EVENTS
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
# GRIDAPPS-D REAL-TIME WEBSOCKET EVENTS
# ================================================================================================

# ─── SocketIO Event Handlers ──────────────────────────────────────


@socketio.on("start-simulation")
def handle_start_simulation(config):
    try:
        result = gridappsd_helper.start_simulation(config)

        # Subscribe to output and relay to the client via WebSocket
        def on_sim_output(headers, message):

            TYPES = {
                "LinearShuntCompensator": "capacitor",
                "Breaker": "switch",
                "Fuse": "switch",
                "Switch": "switch",
                "Sectionaliser": "switch",
                "LoadBreakSwitch": "switch",
                "Disconnector": "switch",
                "Recloser": "switch",
            }

            socketio.emit("sim-output", message)

            # Process measurements through the map to emit equipment-level updates
            active_measurement_map = cim_helper.active_measurement_map
            if active_measurement_map:
                msg = message.get("message", message)
                measurements = msg.get("measurements", {})
                timestamp = msg.get("timestamp")

                switch_updates = []
                capacitor_updates = []

                for measurment_mRID, measurment_data in measurements.items():
                    mapping = active_measurement_map.get(measurment_mRID)
                    if not mapping:
                        continue

                    equipment_type = mapping.get("conducting_equipment_type", "")
                    meas_type = mapping.get("measurement_type", "")

                    # Switch state: Discrete "Pos" measurements carry value 0=open, 1=closed
                    if (equipment_type in TYPES and TYPES[equipment_type] == "switch") and meas_type == "Pos":
                        switch_updates.append(
                            {
                                "equipment_mrid": mapping.get(
                                    "conducting_equipment_mrid", ""
                                ),
                                "equipment_name": mapping.get(
                                    "conducting_equipment_name", ""
                                ),
                                "equipment_type": equipment_type,
                                "measurement_mrid": measurment_mRID,
                                "phases": mapping.get("phases", ""),
                                "value": measurment_data["value"],
                                "open": measurment_data["value"] == 0,
                            }
                        )
                    
                    if (equipment_type in TYPES and TYPES[equipment_type] == "capacitor") and meas_type == "Pos":
                        capacitor_updates.append(
                            {
                                "equipment_mrid": mapping.get(
                                    "conducting_equipment_mrid", ""
                                ),
                                "equipment_name": mapping.get(
                                    "conducting_equipment_name", ""
                                ),
                                "equipment_type": equipment_type,
                                "measurement_mrid": measurment_mRID,
                                "phases": mapping.get("phases", ""),
                                "value": measurment_data["value"],
                            }
                        )
                
                if switch_updates:
                    socketio.emit(
                        "switch-state-update",
                        {
                            "timestamp": timestamp,
                            "switches": switch_updates,
                        },
                    )
                
                if capacitor_updates:
                    socketio.emit(
                        "capacitor-state-update",
                        {
                            "timestamp": timestamp,
                            "capacitors": capacitor_updates,
                        },
                    )

        def on_sim_log(headers, message):
            socketio.emit("sim-log", message)

        gridappsd_helper.subscribe_to_simulation_output(on_sim_output)
        gridappsd_helper.subscribe_to_simulation_log(on_sim_log)

        print("=" * 20 + "result" + "=" * 20)
        print(json.dumps(result, indent=2))
        print("=" * 46)
        return result

    except Exception as e:
        return {"error": {"message": str(e)}}


@socketio.on("sim-input")
def handle_sim_input(input):
    try:
        print("=" * 10 + "Received sim input" + "=" * 10)
        print(json.dumps(input, indent=2))
        print("=" * 34)
        gridappsd_helper.send_simulation_input(input)
        return "", 204
    except Exception as e:
        return {"error": str(e)}


@socketio.on("pause-simulation")
def handle_pause_simulation(sim_id):
    try:
        return gridappsd_helper.pause_simulation(sim_id)
    except Exception as e:
        return {"error": str(e)}


@socketio.on("resume-simulation")
def handle_resume_simulation(sim_id):
    try:
        return gridappsd_helper.resume_simulation(sim_id)
    except Exception as e:
        return {"error": str(e)}


@socketio.on("stop-simulation")
def handle_stop_simulation(sim_id):
    try:
        return gridappsd_helper.stop_simulation(sim_id)
    except Exception as e:
        return {"error": str(e)}


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
    port = int(os.environ.get("FLASK_PORT", 5051))
    socketio.run(
        app,
        host="127.0.0.1",
        port=port,
        debug=False,
        log_output=True,
    )
