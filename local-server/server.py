import functools
import hmac
import json
import os
import shutil
import tempfile
import traceback
from contextlib import contextmanager

import gevent
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from flask_socketio import SocketIO
from gevent.lock import BoundedSemaphore
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

import agenthelper
from cimhelper import CIMHelper
from glmhelper import GLMHelper
from gridappsdhelper import GridAPPSDHelper
from jsonhelper import JSONHelper

# ================================================================================================
# HELPERS
# ================================================================================================

json_helper = JSONHelper()
glm_helper = GLMHelper()
cim_helper = CIMHelper()
gridappsd_helper = GridAPPSDHelper()
cim_load_lock = BoundedSemaphore(1)

def run_cim_parse(fn, **kwargs):
    with cim_load_lock:
        try:
            result = gevent.get_hub().threadpool.apply(fn, kwds=kwargs)
        except Exception:
            # A failed parse leaves the helper half-populated, so later requests
            # would answer from the previous model's measurement map.
            cim_helper.release()
            raise
    return result


def count_objects(gjs: dict) -> int:
    return sum(len(entry.get("objects", [])) for entry in (gjs or {}).values())


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


# ================================================================================================
# FLASK APP SETUP
# ================================================================================================

_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_env == "*":
    cors_origins = "*"
elif _cors_env:
    cors_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
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

app = Flask(__name__)
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "65"))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

CORS(
    app,
    origins=cors_origins,
    methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=cors_origins != "*",
)
socketio = SocketIO(
    app, async_mode="gevent", cors_allowed_origins=cors_origins, allow_upgrades=True
)

# The main thread's hub, captured here: get_hub() on a broker callback thread
# would create a separate hub for that thread.
_hub = gevent.get_hub()

def emit_threadsafe(event: str, payload):
    """socketio.emit() from a non-greenlet thread."""
    _hub.loop.run_callback_threadsafe(socketio.emit, event, payload)

EXPOSE_TRACEBACKS = _env_flag("EXPOSE_TRACEBACKS")

def error_body(exc, message=None):
    """Error body for the exception being handled. Always logs the traceback,
    but only exposes it to the client when EXPOSE_TRACEBACKS is set."""
    tb = traceback.format_exc()
    print(tb)
    body = {"error": message if message is not None else str(exc)}
    if EXPOSE_TRACEBACKS:
        body["traceback"] = tb
    return body


def json_errors(status=500):
    """Answer any exception escaping the view with error_body at `status`."""
    def decorate(view):
        @functools.wraps(view)
        def wrapper(*args, **kwargs):
            try:
                return view(*args, **kwargs)
            except Exception as e:
                return error_body(e), status
        return wrapper
    return decorate


# Every route returns { "error": ... } on the failures it anticipates. Without
# these, anything else — the 413 Flask raises from MAX_CONTENT_LENGTH, a wrong
# Content-Type, an exception escaping a view — comes back as Werkzeug's HTML
# page, which the frontend's errorText() surfaces verbatim into an alert.
@app.errorhandler(HTTPException)
def _http_error(exc):
    if exc.code == 413:
        message = (
            f"That upload is larger than the {MAX_UPLOAD_MB} MB limit. "
            "Set MAX_UPLOAD_MB higher to raise it."
        )
    else:
        message = exc.description
    return {"error": message}, exc.code


@app.errorhandler(Exception)
def _unhandled_error(exc):
    return error_body(exc, message=f"Server error: {exc}"), 500


# Without this an exception inside a socket handler returns nothing at all —
# the caller's ack callback simply never fires and the script hangs.
@socketio.on_error_default
def _socket_error(exc):
    return error_body(exc)


EXPORT_BASE_DIR = os.path.abspath(
    os.environ.get("GLIMPSE_EXPORT_DIR", os.path.join(tempfile.gettempdir(), "glimpse_exports"))
)
ALLOW_ANY_EXPORT_PATH = _env_flag("GLIMPSE_ALLOW_ANY_EXPORT_PATH")

def safe_export_path(user_path):
    """Resolve a client-supplied export path. Raises ValueError if it escapes the
    allowed base directory (unless explicitly allowed via env)."""
    if not user_path or not isinstance(user_path, str):
        raise ValueError("A destination path is required.")
    if ALLOW_ANY_EXPORT_PATH:
        return user_path
    os.makedirs(EXPORT_BASE_DIR, exist_ok=True)
    # Treat the input as relative to the base dir; strip any leading separators so
    # an absolute path can't jump out of it.
    candidate = os.path.abspath(os.path.join(EXPORT_BASE_DIR, user_path.lstrip("/\\")))
    if os.path.commonpath([candidate, EXPORT_BASE_DIR]) != EXPORT_BASE_DIR:
        raise ValueError("Destination path escapes the allowed export directory.")
    return candidate


@contextmanager
def saved_uploads(prefix):
    """Save the request's 'files' into a temp dir, yielding their paths; the dir
    is removed on exit."""
    tmpdir = tempfile.mkdtemp(prefix=prefix)
    try:
        paths = []
        for f in request.files.getlist("files"):
            if not f or f.filename == "":
                continue
            dest_path = os.path.join(tmpdir, secure_filename(f.filename))
            f.save(dest_path)
            paths.append(dest_path)
        yield paths
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
API_TOKEN = os.environ.get("GLIMPSE_API_TOKEN", "").strip()
_AUTH_EXEMPT_PATHS = {"/"}

def _valid_token(token):
    return bool(token) and hmac.compare_digest(token, API_TOKEN)

@app.before_request
def _require_api_token():
    if not API_TOKEN:
        return None
    if request.method == "OPTIONS" or request.path in _AUTH_EXEMPT_PATHS:
        return None
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header[:7].lower() == "bearer " else ""
    if not _valid_token(token):
        return jsonify({"error": "Unauthorized"}), 401
    return None

@socketio.on("connect")
def _authenticate_socket(auth=None):
    if not API_TOKEN:
        return True
    token = auth.get("token") if isinstance(auth, dict) else None
    return _valid_token(token)

# ---------------------------------------------------------------------------
# Bundled example models
# ---------------------------------------------------------------------------
EXAMPLE_MODELS = {
    "ieee123": {
        "name": "IEEE 123 Node Test Feeder",
        "description": "Medium-size CIM distribution feeder (IEEE123.xml)",
        "file": os.path.join("CIM", "IEEE123.xml"),
        "format": "cim",
    },
    "glm3000": {
        "name": "3000 Bus GridLAB-D Model",
        "description": "GridLAB-D transmission model (3000_model.glm)",
        "file": os.path.join("3000", "3000_model.glm"),
        "format": "glm",
    },
    "ieee9500": {
        "name": "IEEE 9500 Node Test Feeder",
        "description": "Large CIM distribution feeder (IEEE9500bal.xml)",
        "file": os.path.join("CIM", "IEEE9500bal.xml"),
        "format": "cim",
    },
}


def _resolve_models_dir():
    """Locate the directory holding the bundled example models, or None."""
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.environ.get("GLIMPSE_MODELS_DIR", "").strip(),
        os.path.join(here, "models"),
        os.path.abspath(os.path.join(here, "..", "models")),
    ]
    for candidate in candidates:
        if candidate and os.path.isdir(candidate):
            return candidate
    return None


MODELS_DIR = _resolve_models_dir()


def _example_model_path(example_id):
    """Absolute path of an example model's file, or None if unavailable."""
    entry = EXAMPLE_MODELS.get(example_id)
    if entry is None or MODELS_DIR is None:
        return None
    path = os.path.join(MODELS_DIR, entry["file"])
    return path if os.path.isfile(path) else None


# ================================================================================================
# EXAMPLE MODEL ENDPOINTS
# ================================================================================================


@app.route("/api/examples", methods=["GET"])
def list_examples():
    """List the bundled example models that are actually present on disk."""
    examples = [
        {
            "id": example_id,
            "name": entry["name"],
            "description": entry["description"],
            "format": entry["format"],
        }
        for example_id, entry in EXAMPLE_MODELS.items()
        if _example_model_path(example_id)
    ]
    return jsonify({"examples": examples}), 200


@app.route("/api/examples/load", methods=["POST"])
def load_example():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    example_id = (request.get_json() or {}).get("id")
    path = _example_model_path(example_id)
    if path is None:
        return jsonify({"error": f"Unknown or unavailable example model: {example_id}"}), 404

    is_cim = EXAMPLE_MODELS[example_id]["format"] == "cim"
    if is_cim:
        data, object_details = run_cim_parse(cim_helper.cim_to_gjs, filepaths=[path])
    else:
        data, object_details = glm_helper.parse_glm([path]), {}
    return jsonify({
        "data": data,
        "themeData": None,
        "objectDetails": object_details,
        "isCIM": is_cim,
    })


# ================================================================================================
# CIM OBJECT MANAGEMENT ENDPOINTS
# ================================================================================================


def _feeder_and_mrid():
    """(feeder_id, mRID, None) from the JSON body, or (None, None, error response)."""
    if not request.is_json:
        return None, None, (jsonify({"error": "Request must be JSON"}), 400)

    data = request.get_json()
    feeder_id = data.get("feeder_id")
    mRID = data.get("mRID")
    if not feeder_id or not mRID:
        return None, None, (jsonify({"error": "Both 'feeder_id' and 'mRID' are required"}), 400)
    return feeder_id, mRID, None


@app.route("/api/cim/objects", methods=["POST"])
@json_errors()
def get_object():
    feeder_id, mRID, error = _feeder_and_mrid()
    if error:
        return error

    res = cim_helper.get_cim_object(feeder_id, mRID)
    return res, 404 if "error" in res else 200


@app.route("/api/cim/objects", methods=["DELETE"])
@json_errors()
def delete_object():
    feeder_id, mRID, error = _feeder_and_mrid()
    if error:
        return error

    if not cim_helper.delete_cim_object(feeder_id, mRID):
        return jsonify({"error": f"Failed to delete object {mRID} in feeder {feeder_id}"}), 400
    return jsonify({
        "success": True,
        "feeder_id": feeder_id,
        "mRID": mRID,
        "message": "Object deleted successfully",
    })


@app.route("/api/cim/objects/mermaid", methods=["POST"])
@json_errors()
def get_object_mermaid():
    feeder_id, mRID, error = _feeder_and_mrid()
    if error:
        return error
    return cim_helper.get_mermaid(feeder_id, mRID), 200


# ================================================================================================
# JSON CONVERSION
# ================================================================================================


@app.route("/api/upload/json", methods=["POST"])
def upload_json():
    if "files" not in request.files:
        return {"error": "No 'files' part in the form data."}, 400

    with saved_uploads("json_upload_") as paths:
        if not paths:
            return {"error": "No valid files received."}, 400

        theme_data, json_paths = json_helper.split_theme(paths)

        json_dict = {}
        for path in json_paths:
            with open(path, "r") as json_file:
                json_dict[os.path.basename(path)] = json.load(json_file)

        try:
            validated_data = json_helper.validate_json_data(json_dict)
        except ValueError as e:
            return error_body(e), 400
        return jsonify({"data": validated_data, "themeData": theme_data})


# ================================================================================================
# GLM CONVERSION ENDPOINTS
# ================================================================================================


@app.route("/api/upload/glm", methods=["POST"])
def glm_upload():
    if not request.files.getlist("files"):
        return {"error": "No files uploaded."}, 400

    with saved_uploads("glm_upload_") as paths:
        if not paths:
            return {"error": "No valid files received."}, 400

        print(f"[SERVER] Parsing GLM upload: {paths}")
        theme_data, glm_paths = json_helper.split_theme(paths)
        return jsonify({"data": glm_helper.parse_glm(glm_paths), "themeData": theme_data})

@app.route("/api/export/glm", methods=["POST"])
def export_glm():
    json_data = request.get_json()

    if not json_data or "data" not in json_data:
        return {"error": "No data provided."}, 400

    data = json_data["data"]
    if not isinstance(data, dict):
        return {"error": "'data' must be an object keyed by file name."}, 400

    tmpdir = tempfile.mkdtemp(prefix="glm_export_")

    try:
        zip_buffer = glm_helper.json_to_glm(data, tmpdir)
        return send_file(
            zip_buffer,
            mimetype="application/zip",
            as_attachment=True,
            download_name="exported_model.zip"
        )
    except ValueError as e:
        # An unusable or escaping file name in the payload — a client error.
        return {"error": str(e)}, 400
    except Exception as e:
        return error_body(e, message=f"Export failed: {e}"), 500
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

# ================================================================================================
# CIM OBJECT UPDATE ENDPOINT
# ================================================================================================


@app.route("/api/upload/cim", methods=["POST"])
def cim_to_glimpse():
    if "files" not in request.files:
        return {"error": "No 'files' part in the form data."}, 400

    with saved_uploads("cim_upload_") as paths:
        if not paths:
            return {"error": "No valid files received."}, 400

        glimpse_structure_data, object_details = run_cim_parse(
            cim_helper.cim_to_gjs, filepaths=paths
        )

        if count_objects(glimpse_structure_data) == 0:
            # An unreadable model parses to an empty graph rather than raising,
            # which would otherwise load a blank canvas with no explanation.
            return {
                "error": "No CIM objects could be read from the uploaded file(s). "
                "Check that they are valid CIM XML models."
            }, 400

        # Drawn objects ship their attributes and associations up front; objects
        # the model only points at are fetched from /api/cim/objects.
        return {
            "data": glimpse_structure_data,
            "themeData": None,
            "objectDetails": object_details,
            "isCIM": True,
        }


@app.route("/api/export/export-cim", methods=["POST"])
def export_cim_file():
    # CIM structural export is unfinished and no client calls this route yet.
    # When implemented, validate the destination with safe_export_path().
    return jsonify({"error": "CIM structural export is not implemented yet."}), 501


@app.route("/api/export/export-cim-coordinates", methods=["POST"])
def export_cim_coordinates():
    cim_data = request.get_json()
    if not cim_data:
        return jsonify({"error": "Request must be JSON"}), 400

    try:
        feeder_id = cim_data["feeder_id"]
        new_coords_obj = cim_data["data"]
        output_path = safe_export_path(cim_data["filepath"])
    except KeyError as e:
        return jsonify({"error": f"Missing required field: {e}"}), 400
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        cim_helper.export_cim_coords(feeder_id, new_coords_obj, output_path)
    except Exception as e:
        return error_body(e), 500
    return "", 204


@app.route("/api/cim/measurements", methods=["GET"])
@json_errors()
def get_cim_measurements():
    # The measurement map built at CIM load time, so the plot creator can list
    # device measurements before a simulation starts. Empty for GLM/JSON models.
    return jsonify({"measurements": cim_helper.get_measurement_catalog()}), 200


# ================================================================================================
# GridAPPS-D INTERACTION ENDPOINTS
# ================================================================================================
@app.route("/api/gridappsd/models", methods=["POST"])
def get_models():
    req_data = request.get_json()

    print(f"\nModel IDs Received:\n{req_data}\n")

    try:
        # Written by the load thread via progress_cb, read by this greenlet.
        progress = {}

        def load_models():
            # Best-effort: pull distribution-area topology per model from the
            # GridAPPS-D topology service. If it's unavailable, cim_to_gjs falls
            # back to deriving areas from the CIM model itself.
            topology_outputs = {}
            if gridappsd_helper.is_connected():
                for model_id in req_data:
                    topo = gridappsd_helper.get_distributed_areas(model_id)
                    if topo:
                        topology_outputs[model_id] = topo

            if topology_outputs:
                print("Topology outputs retrieved from GridAPPS-D")
            else:
                print("No topology outputs retrieved from GridAPPS-D; falling back to CIM model")

            return cim_helper.cim_to_gjs(
                model_IDs=req_data,
                topology_outputs=topology_outputs,
                progress_cb=progress.update,
            )

        with cim_load_lock:
            worker = gevent.get_hub().threadpool.spawn(load_models)
            last_reported = None
            while not worker.ready():
                gevent.sleep(0.5)
                if progress and progress != last_reported:
                    last_reported = dict(progress)
                    socketio.emit("model-load-progress", last_reported)
            gjs, object_details = worker.get()

        if not gjs:
            return jsonify({"error": "No data returned for the given model IDs"}), 404
        return jsonify({"data": gjs, "themeData": None, "objectDetails": object_details, "isCIM": True}), 200
    except Exception as e:
        return error_body(e), 500


@app.route("/api/gridappsd/agents", methods=["GET"])
@json_errors()
def get_agents():
    model_id = request.args.get("model") or ""

    print(f"Requesting agents for model {model_id}")

    if not model_id:
        loaded = list(cim_helper.area_maps.keys())
        if len(loaded) != 1:
            return jsonify({
                "error": "A 'model' query parameter is required when zero or "
                         "several models are loaded.",
                "loaded": loaded,
            }), 400
        model_id = loaded[0]

    if model_id not in cim_helper.area_maps:
        return jsonify({"error": f"Model {model_id} is not loaded."}), 404

    return jsonify(agenthelper.build_agent_model(
        area_map=cim_helper.area_maps[model_id],
        object_index=cim_helper.object_index.get(model_id, {}),
        model_id=model_id,
        source=request.args.get("source") or "derived",
        gridappsd_helper=gridappsd_helper,
    )), 200


@app.route("/api/gridappsd/model-info", methods=["GET"])
@json_errors(status=503)
def get_gridappsd_models():
    if not gridappsd_helper.is_connected():
        return {"error": "Not connected to GridAPPS-D"}, 503
    return jsonify(gridappsd_helper.get_models()), 200


@app.route("/api/gridappsd/status", methods=["GET"])
def get_gridappsd_status():
    try:
        # Non-destructive: try_connect() tears down the live connection (and with
        # it any simulation subscriptions) before rebuilding, and the frontend
        # polls this route every time the load-model modal opens. Only reconnect
        # when there is nothing to preserve.
        broker_up = gridappsd_helper.is_connected() or gridappsd_helper.try_connect()

        # A reachable broker is not a usable platform: the gridappsd container
        # alone answers on 61613 while blazegraph and friends are down. Confirm
        # with a real query, off the event loop since the probe blocks.
        connected = broker_up and gevent.get_hub().threadpool.apply(
            gridappsd_helper.is_platform_ready
        )

        if connected:
            message = "Connected to GridAPPS-D"
        elif broker_up:
            message = (
                "The GridAPPS-D message broker is reachable, but the platform is not "
                "answering queries — check that blazegraph and the other platform "
                "containers are running."
            )
        else:
            message = "Not connected to GridAPPS-D"

        return json.dumps({"connected": connected, "message": message}), 200

    except Exception as e:
        # 200 so the React app can handle the response
        return json.dumps({**error_body(e), "connected": False}), 200


# ================================================================================================
# GLIMPSE WEBSOCKET EVENTS
# ================================================================================================
@socketio.on("load-graph")
def load_graph(data):
    # Accept GLIMPSE objects format or NetworkX node-link data and normalize
    # it into the { name: { objects: [...] } } shape the frontend consumes.
    try:
        prepared = json_helper.prepare_graph_payload(data)
    except ValueError as e:
        print(str(e))
        return {"error": str(e)}

    socketio.emit("load-graph", {"data": prepared})
    return {"status": "ok", "objectCount": count_objects(prepared)}


@socketio.on("update")
def update_data(data):
    # Update node/edge color, size, and/or hidden state on the connected frontends.
    if not isinstance(data, dict):
        return {"error": "Update payload must be a JSON object."}

    object_id = data.get("id")
    element_type = data.get("elementType")
    updates = data.get("updates")

    if object_id is None or element_type not in ("node", "edge"):
        return {
            "error": "Update payload requires 'id' and 'elementType' ('node' or 'edge')."
        }
    if not isinstance(updates, dict):
        return {"error": "Update payload requires an 'updates' object."}

    # Normalize to the supported update keys; null means "leave unchanged".
    socketio.emit("update-data", {
        "id": object_id,
        "elementType": element_type,
        "updates": {
            "color": updates.get("color"),
            "size": updates.get("size"),
            "hidden": updates.get("hidden"),
        },
    })
    return {"status": "ok"}


@socketio.on("add-node")
def add_node(new_node_data):
    if not isinstance(new_node_data, dict) or "attributes" not in new_node_data:
        return {"error": "add-node requires an object with an 'attributes' key."}
    socketio.emit("add-node", new_node_data)
    return {"status": "ok"}


@socketio.on("add-edge")
def add_edge(new_edge_data):
    if not isinstance(new_edge_data, dict) or "attributes" not in new_edge_data:
        return {"error": "add-edge requires an object with an 'attributes' key."}
    socketio.emit("add-edge", new_edge_data)
    return {"status": "ok"}


@socketio.on("delete-node")
def delete_node(node_id):
    if not node_id:
        return {"error": "delete-node requires a node id."}
    socketio.emit("delete-node", node_id)
    return {"status": "ok"}


@socketio.on("delete-edge")
def delete_edge(edge_id):
    if not edge_id:
        return {"error": "delete-edge requires an edge id."}
    socketio.emit("delete-edge", edge_id)
    return {"status": "ok"}


@socketio.on("agents-update")
def agents_update(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("agents"), list):
        return {"error": "agents-update requires an object with an 'agents' list."}

    socketio.emit("agents-update", payload)
    return {"status": "ok", "agentCount": len(payload["agents"])}


# ================================================================================================
# GRIDAPPS-D REAL-TIME WEBSOCKET EVENTS
# ================================================================================================


@socketio.on("start-simulation")
def handle_start_simulation(config):
    try:
        result = gridappsd_helper.start_simulation(config)

        # Decode measurements through the CIM measurement map into
        # equipment-level updates and relay them to the frontends.
        def on_sim_output(headers, message: dict):
            msg = message.get("message", message)
            sim_output = {"timestamp": msg.get("timestamp"), "Analog": [], "Discrete": []}
            measurement_map = cim_helper.active_measurement_map

            for measurement_mrid, measurement_data in msg.get("measurements", {}).items():
                for measurement_class in ("Analog", "Discrete"):
                    mapping = measurement_map[measurement_class].get(measurement_mrid)
                    if not mapping:
                        continue

                    eq_mrid = mapping.get("conducting_equipment_mrid", "")
                    measurement_output = {
                        "equipment_mrid": eq_mrid,
                        "equipment_name": mapping.get("conducting_equipment_name", ""),
                        "equipment_type": mapping.get("conducting_equipment_type", ""),
                        "measurement_type": mapping.get("measurement_type", ""),  # Pos, PNV, VA
                        "phases": mapping.get("phases", ""),
                        "connectivity_node_mrid": mapping.get("connectivity_node_mrid", ""),
                        **measurement_data,
                    }

                    normal_limit = gridappsd_helper.current_limit_map.get(eq_mrid)
                    if normal_limit:
                        measurement_output["normal_limit"] = normal_limit

                    sim_output[measurement_class].append(measurement_output)

            emit_threadsafe("sim-output", sim_output)

        def on_sim_log(headers, message):
            emit_threadsafe("sim-log", message)

        gridappsd_helper.subscribe_to_simulation_output(on_sim_output)
        gridappsd_helper.subscribe_to_simulation_log(on_sim_log)

        print(f"Simulation started:\n{json.dumps(result, indent=2)}")
        return result

    except Exception as e:
        return {"error": {"message": str(e)}}


@socketio.on("sim-input")
def handle_sim_input(input_data):
    try:
        gridappsd_helper.send_simulation_input(input_data)
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
    """Basic API information endpoint (also the container health check)."""
    return {
        "api": "GLIMPSE CIM-Graph Flask Backend",
        "version": "0.8.6",
    }


# ================================================================================================
# MAIN APPLICATION ENTRY POINT
# ================================================================================================

if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5052))
    # Bind to loopback for local dev; containers set FLASK_HOST=0.0.0.0
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    socketio.run(
        app,
        host=host,
        port=port,
        debug=False,
        log_output=True,
    )
