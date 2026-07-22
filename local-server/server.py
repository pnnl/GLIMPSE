import os
import json
import tempfile
import traceback
import gc
import time
import hmac

import gevent
from gevent.lock import BoundedSemaphore

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

# CIM loads run off the event loop (gevent threadpool) so the server stays
# responsive, which means two loads could now interleave — but cim_helper keeps
# per-load state (FEEDERS, measurement map). Serialize them.
cim_load_lock = BoundedSemaphore(1)

# ================================================================================================
# FLASK APP SETUP
# ================================================================================================
# Allowed CORS origins. Override for deployment via the CORS_ORIGINS env var
# (comma-separated list of origins, or "*" to allow any). Defaults to the local
# dev ports.
_default_cors_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "http://localhost:61613",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:61613",
]

_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_env == "*":
    cors_origins = "*"
elif _cors_env:
    cors_origins = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
else:
    cors_origins = _default_cors_origins

methods = ["GET", "POST", "DELETE", "OPTIONS"]
allowed_headers = ["Content-Type", "Authorization"]

# Never combine credentialed requests with a wildcard origin: that reflects any
# origin back with Access-Control-Allow-Credentials, which browsers reject and
# which would broaden cross-origin access. Only allow credentials when origins
# are explicitly pinned.
allow_credentials = cors_origins != "*"

app = Flask(__name__)

# Cap request bodies so unbounded JSON/CIM uploads can't exhaust memory. Override
# with MAX_UPLOAD_MB. (GLM parsing enforces its own per-file limit as well.)
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_UPLOAD_MB", "65")) * 1024 * 1024

CORS(
    app,
    origins=cors_origins,
    methods=methods,
    allow_headers=allowed_headers,
    supports_credentials=allow_credentials,
)
socketio = SocketIO(
    app, async_mode="gevent", cors_allowed_origins=cors_origins, allow_upgrades=True
)

# Whether to include Python tracebacks in error responses. Off by default so we
# don't leak internal paths/stack details to clients; enable for local debugging.
EXPOSE_TRACEBACKS = os.environ.get("EXPOSE_TRACEBACKS", "").strip().lower() in (
    "1",
    "true",
    "yes",
)


def error_body(exc, tb, message=None, extra=None):
    """Build an error response body. Always logs the traceback server-side, but
    only exposes it to the client when EXPOSE_TRACEBACKS is set."""
    print(tb)
    body = {"error": message if message is not None else str(exc)}
    if extra:
        body.update(extra)
    if EXPOSE_TRACEBACKS:
        body["traceback"] = tb
    return body


# ---------------------------------------------------------------------------
# Export path safety
# ---------------------------------------------------------------------------
# Export endpoints historically accepted an absolute destination path from the
# request body and wrote to it directly (arbitrary write / path traversal). By
# default we confine writes to GLIMPSE_EXPORT_DIR and reject traversal. A desktop
# build that intentionally lets the user pick any save location can opt out with
# GLIMPSE_ALLOW_ANY_EXPORT_PATH=1.
EXPORT_BASE_DIR = os.path.abspath(
    os.environ.get("GLIMPSE_EXPORT_DIR", os.path.join(tempfile.gettempdir(), "glimpse_exports"))
)
ALLOW_ANY_EXPORT_PATH = os.environ.get("GLIMPSE_ALLOW_ANY_EXPORT_PATH", "").strip().lower() in (
    "1",
    "true",
    "yes",
)


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


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
# Shared bearer token. When GLIMPSE_API_TOKEN is unset (the default), auth is
# disabled — appropriate for the desktop build where the server is bound to
# loopback only. For any networked deployment (FLASK_HOST=0.0.0.0), set the token
# so every HTTP request and WebSocket connection must present it.
API_TOKEN = os.environ.get("GLIMPSE_API_TOKEN", "").strip()

# Paths reachable without a token even when auth is enabled: CORS preflight
# carries no Authorization header, and the root health check is used by the
# Electron launcher / container healthchecks to detect readiness.
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
    # Returning False rejects the connection before any event handlers run.
    # auth defaults to None for flask-socketio versions that omit the handshake arg.
    if not API_TOKEN:
        return True
    token = auth.get("token") if isinstance(auth, dict) else None
    return _valid_token(token)


# ---------------------------------------------------------------------------
# Bundled example models
# ---------------------------------------------------------------------------
# A few sample models offered in the frontend's "Example Models" tab so users
# can explore GLIMPSE without hunting for files. `file` is relative to the
# models directory, resolved at startup in this order: GLIMPSE_MODELS_DIR env
# override, a `models/` folder next to this file (the PyInstaller bundle — see
# server.spec — or a Docker bind mount), or the repo's top-level models/ folder
# when running from source. Entries whose file is missing are not offered.
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
        "description": "Large CIM distribution feeder (IEEE9500bal.xml) — takes a while to load",
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
    """Parse a bundled example model server-side and return it in the same
    { data, themeData } shape as the /api/upload/* endpoints."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    example_id = (request.get_json() or {}).get("id")
    entry = EXAMPLE_MODELS.get(example_id)
    path = _example_model_path(example_id)
    if entry is None or path is None:
        return jsonify({"error": f"Unknown or unavailable example model: {example_id}"}), 404

    try:
        if entry["format"] == "glm":
            data = glm_helper.parse_glm([path])
        else:
            # Same lock and threadpool treatment as /api/upload/cim: XML
            # parsing shares cim_helper state and can take a while on big files.
            with cim_load_lock:
                data = gevent.get_hub().threadpool.apply(
                    cim_helper.cim_to_gjs, kwds={"filepaths": [path]}
                )
        return json.dumps(
            {"data": data, "themeData": None, "isCIM": entry["format"] == "cim"}
        )
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb, message=f"Server error: {str(e)}"), 500


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
        return jsonify(error_body(e, tb)), 500


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
        return jsonify(error_body(e, tb)), 500


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
        return jsonify(error_body(e, tb)), 500


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
            return error_body(e, tb), 400

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb, message=f"Server error: {str(e)}"), 500
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
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb, message=f"Server error: {str(e)}"), 500
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
        return error_body(e, tb, message=f"Export failed: {str(e)}"), 500

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

        # Same lock and threadpool treatment as /api/gridappsd/models: XML
        # parsing shares cim_helper state and can take a while on big files.
        with cim_load_lock:
            glimpse_structure_data = gevent.get_hub().threadpool.apply(
                cim_helper.cim_to_gjs, kwds={"filepaths": paths}
            )

        return glimpse_structure_data

    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb, message=f"Server error: {str(e)}"), 500
    finally:
        # Cleanup
        shutil.rmtree(tmpdir, ignore_errors=True)


@app.route("/api/export/export-cim", methods=["POST"])
def export_cim_file():
    # CIM structural export (adding / rewiring objects and writing a new XML) is
    # unfinished: cim_helper.export_cim and its cimbuilder dependencies are still
    # commented out (see cimhelper.py), and no client calls this route yet. Return
    # an explicit 501 rather than the previous 500 AttributeError. When the export
    # logic is completed, validate the destination with safe_export_path() before
    # writing (as export-cim-coordinates does).
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
        tb = traceback.format_exc()
        return jsonify(error_body(e, tb)), 500
    return "", 204


@app.route("/api/cim/measurements", methods=["GET"])
def get_cim_measurements():
    # Expose the measurement map built at CIM model-load time so the frontend plot
    # creator can list device measurements before a simulation starts. Returns an
    # empty list for non-CIM models (GLM/JSON have no measurement map).
    try:
        return jsonify({"measurements": cim_helper.get_measurement_catalog()}), 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return jsonify(error_body(e, tb)), 500


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

        # Run the load in a native thread (gevent threadpool): its blocking
        # SPARQL/STOMP I/O would otherwise freeze the whole event loop — health
        # checks, Socket.IO ping/pong, every other request — for minutes on a
        # large model. This greenlet polls cooperatively and relays progress to
        # connected clients while the thread works.
        with cim_load_lock:
            worker = gevent.get_hub().threadpool.spawn(load_models)
            last_reported = None
            while not worker.ready():
                gevent.sleep(0.5)
                if progress and progress != last_reported:
                    last_reported = dict(progress)
                    socketio.emit("model-load-progress", last_reported)
            gjs = worker.get()

        if gjs is None:
            return jsonify({"error": "No data returned for the given model IDs"}), 404
        return gjs, 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return json.dumps(error_body(e, tb)), 500


@app.route("/api/gridappsd/model-info", methods=["GET"])
def get_gridappsd_models():
    try:
        if not gridappsd_helper.is_connected():
            return json.dumps({"error": "Not connected to GridAPPS-D"}), 503

        models = gridappsd_helper.get_models()
        return json.dumps(models), 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return json.dumps(error_body(e, tb)), 503


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
            json.dumps(error_body(e, tb, extra={"connected": False})),
            200,
        )  # Return 200 so React app can handle the response


# ================================================================================================
# GLIMPSE WEBSOCKET EVENTS
# ================================================================================================
@socketio.on("load-graph")
def load_graph(data):
    try:
        # Accept GLIMPSE objects format or NetworkX node-link data and normalize
        # it into the { name: { objects: [...] } } shape the frontend consumes.
        prepared = json_helper.prepare_graph_payload(data)
        socketio.emit("load-graph", {"data": prepared})

        object_count = sum(len(f.get("objects", [])) for f in prepared.values())
        return {"status": "ok", "objectCount": object_count}
    except ValueError as e:
        print(str(e))
        return {"error": str(e)}
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb)


@socketio.on("update")
def update_data(data):
    # Update node/edge color, size, and/or hidden state on the connected frontends.
    try:
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
        normalized = {
            "id": object_id,
            "elementType": element_type,
            "updates": {
                "color": updates.get("color"),
                "size": updates.get("size"),
                "hidden": updates.get("hidden"),
            },
        }
        socketio.emit("update-data", normalized)
        return {"status": "ok"}
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb)


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


# ================================================================================================
# GRIDAPPS-D REAL-TIME WEBSOCKET EVENTS
# ================================================================================================

# ─── SocketIO Event Handlers ──────────────────────────────────────


@socketio.on("start-simulation")
def handle_start_simulation(config):
    try:
        result = gridappsd_helper.start_simulation(config)

        # Subscribe to output and relay to the client via WebSocket
        def on_sim_output(headers, message: dict):
            sim_output = {"timestamp": "", "Analog": [], "Discrete": []}

            # Process measurements through the map to emit equipment-level updates
            active_measurement_map = cim_helper.active_measurement_map
            if active_measurement_map:
                msg = message.get("message", message)
                measurements = msg.get("measurements", {})
                sim_output["timestamp"] = msg.get("timestamp")


                for measurment_mRID, measurment_data in measurements.items():

                    if measurment_mRID in active_measurement_map["Analog"]:
                        mapping = active_measurement_map["Analog"].get(measurment_mRID)

                        if not mapping:
                            continue

                        eq_type = mapping.get("conducting_equipment_type", "")
                        eq_mRID = mapping.get("conducting_equipment_mrid", "")
                        conducting_eq_name = mapping.get("conducting_equipment_name", "")
                        measurement_type = mapping.get("measurement_type", "")

                        measurment_output = {
                            "equipment_mrid": eq_mRID,
                            "equipment_name": conducting_eq_name,
                            "equipment_type": eq_type,
                            "measurement_type": measurement_type, # Pos, PNV, VA
                            "phases": mapping.get("phases", ""),
                            "connectivity_node_mrid": mapping.get("connectivity_node_mrid", ""),
                            **measurment_data
                        }

                        normal_limit = gridappsd_helper.current_limit_map.get(eq_mRID, None)
                        if normal_limit:
                            measurment_output["normal_limit"] = normal_limit

                        sim_output["Analog"].append(measurment_output)

                        
                    if measurment_mRID in active_measurement_map["Discrete"]:
                        mapping = active_measurement_map["Discrete"].get(measurment_mRID)

                        if not mapping:
                            continue

                        eq_type = mapping.get("conducting_equipment_type", "")
                        eq_mRID = mapping.get("conducting_equipment_mrid", "")
                        conducting_eq_name = mapping.get("conducting_equipment_name", "")
                        measurement_type = mapping.get("measurement_type", "")

                        measurment_output = {
                            "equipment_mrid": eq_mRID,
                            "equipment_name": conducting_eq_name,
                            "equipment_type": eq_type,
                            "measurement_type": measurement_type, # Pos, PNV, VA
                            "phases": mapping.get("phases", ""),
                            "connectivity_node_mrid": mapping.get("connectivity_node_mrid", ""),
                            **measurment_data
                        }

                        normal_limit = gridappsd_helper.current_limit_map.get(eq_mRID, None)
                        if normal_limit:
                            measurment_output["normal_limit"] = normal_limit

                        sim_output["Discrete"].append(measurment_output)
            
            socketio.emit("sim-output", sim_output)

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
    """Basic API information endpoint"""
    return {"api": "GLIMPSE CIM-Graph Flask Backend", "version": "0.8.2"}


# ================================================================================================
# MAIN APPLICATION ENTRY POINT
# ================================================================================================

if __name__ == "__main__":
    # Start the Flask-SocketIO server
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
