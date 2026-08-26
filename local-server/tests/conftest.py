"""Shared fixtures for the server tests.

server.py decides its feature set at import time from GLIMPSE_MODE, so a test
that wants a particular mode has to (re)import the module with that env set.
load_server() does exactly that and leaves sys.modules clean for the next test.
"""

import importlib
import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = REPO_ROOT / "models"


def load_server(mode: str):
    """Import a fresh server module in the given GLIMPSE_MODE ("hosted"/"desktop")."""
    previous = os.environ.get("GLIMPSE_MODE")
    os.environ["GLIMPSE_MODE"] = mode
    # Drop the cached module *and* cimhelper so each mode gets its own helper
    # singletons — otherwise state from one mode's test leaks into the next.
    for name in ("server", "cimhelper"):
        sys.modules.pop(name, None)
    try:
        return importlib.import_module("server")
    finally:
        if previous is None:
            os.environ.pop("GLIMPSE_MODE", None)
        else:
            os.environ["GLIMPSE_MODE"] = previous


@pytest.fixture
def hosted_server():
    module = load_server("hosted")
    yield module
    sys.modules.pop("server", None)
    sys.modules.pop("cimhelper", None)


@pytest.fixture
def hosted_client(hosted_server):
    return hosted_server.app.test_client()


def cim_model(name: str = "IEEE123.xml") -> Path:
    path = MODELS_DIR / "CIM" / name
    if not path.exists():
        pytest.skip(f"example model not available: {path}")
    return path


def upload_cim(client, name: str = "IEEE123.xml"):
    with open(cim_model(name), "rb") as handle:
        response = client.post(
            "/api/upload/cim",
            data={"files": (handle, name)},
            content_type="multipart/form-data",
        )
    assert response.status_code == 200, response.get_data(as_text=True)[:500]
    return response.get_json()
