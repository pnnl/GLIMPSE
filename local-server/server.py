import hmac
import json
import os
import shutil
import tempfile
import traceback

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


# agents-update is keyed by a model id the caller chooses, so the cache is
# capped rather than left to grow for the life of the process.
MAX_CACHED_AGENT_ROSTERS = 32


# ================================================================================================
# FLASK APP SETUP
# ================================================================================================

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
allow_credentials = cors_origins != "*"

app = Flask(__name__)
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "65"))
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

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

_hub = gevent.get_hub()

def emit_threadsafe(event: str, payload):
    """socketio.emit() from a non-greenlet thread. See _hub above."""
    _hub.loop.run_callback_threadsafe(socketio.emit, event, payload)

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
    return error_body(exc, traceback.format_exc(), message=f"Server error: {exc}"), 500


# Without this an exception inside a socket handler returns nothing at all —
# the caller's ack callback simply never fires and the script hangs.
@socketio.on_error_default
def _socket_error(exc):
    return error_body(exc, traceback.format_exc())


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


def _example_available(example_id) -> bool:
    return _example_model_path(example_id) is not None


def build_example_payload(entry, path):
    object_details = {}
    if entry["format"] == "glm":
        data = glm_helper.parse_glm([path])
    else:
        data, object_details = run_cim_parse(cim_helper.cim_to_gjs, filepaths=[path])
    return {
        "data": data,
        "themeData": None,
        "objectDetails": object_details,
        "isCIM": entry["format"] == "cim",
    }


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
        if _example_available(example_id)
    ]
    return jsonify({"examples": examples}), 200


@app.route("/api/examples/load", methods=["POST"])
def load_example():
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    example_id = (request.get_json() or {}).get("id")
    entry = EXAMPLE_MODELS.get(example_id)
    if entry is None or not _example_available(example_id):
        return jsonify({"error": f"Unknown or unavailable example model: {example_id}"}), 404

    path = _example_model_path(example_id)
    try:
        return jsonify(build_example_payload(entry, path))
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
            return jsonify(response_data)
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

        return jsonify({"data": glm_dict, "themeData": themeData})
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb, message=f"Server error: {str(e)}"), 500
    finally:
        # ignore_errors already tolerates a handle Windows hasn't released yet,
        # which is all the old gc.collect() + sleep(0.5) here was buying — and
        # that sleep stalled every other greenlet, live sim output included.
        shutil.rmtree(tmpdir, ignore_errors=True)

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

        # See run_cim_parse: serialized per process.
        glimpse_structure_data, object_details = run_cim_parse(
            cim_helper.cim_to_gjs, filepaths=paths
        )

        if cim_helper.count_objects(glimpse_structure_data) == 0:
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

            gjs, object_details = cim_helper.cim_to_gjs(
                model_IDs=req_data,
                topology_outputs=topology_outputs,
                progress_cb=progress.update,
            )
            return gjs, object_details

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
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb), 500


@app.route("/api/gridappsd/agents", methods=["GET"])
def get_agents():
    model_id = request.args.get("model") or ""
    source = request.args.get("source") or "derived"

    try:
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
            area_map=cim_helper.area_maps.get(model_id, {}),
            object_index=cim_helper.object_index.get(model_id, {}),
            model_id=model_id,
            source=source,
            gridappsd_helper=gridappsd_helper,
        )), 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return jsonify(error_body(e, tb)), 500


@app.route("/api/gridappsd/model-info", methods=["GET"])
def get_gridappsd_models():
    try:
        if not gridappsd_helper.is_connected():
            return {"error": "Not connected to GridAPPS-D"}, 503

        models = gridappsd_helper.get_models()
        return jsonify(models), 200
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        return error_body(e, tb), 503


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

        return (
            json.dumps({"connected": connected, "message": message}),
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


@socketio.on("agents-update")
def agents_update(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("agents"), list):
        return {"error": "agents-update requires an object with an 'agents' list."}

    model_id = payload.get("model")
    if model_id:
        cache = gridappsd_helper.agent_roster_cache
        cache.pop(model_id, None)
        cache[model_id] = payload
        while len(cache) > MAX_CACHED_AGENT_ROSTERS:
            cache.popitem(last=False)

    socketio.emit("agents-update", payload)
    return {"status": "ok", "agentCount": len(payload["agents"])}


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

            emit_threadsafe("sim-output", sim_output)

        def on_sim_log(headers, message):
            emit_threadsafe("sim-log", message)

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
