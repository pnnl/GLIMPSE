"""The cimgraph edge-construction patch.

A monkeypatch on a third-party library earns a higher burden of proof than
first-party code: it has to be provably invisible in the output, and it has to
get out of the way when the library changes underneath it. These are the tests
for both.
"""

import hashlib
import json

import pytest

import cimgraph_patch
from conftest import cim_model


@pytest.fixture
def patched():
    """Guarantee the patch is on for a test, and leave it as it was found."""
    was_applied = cimgraph_patch.is_applied()
    if not was_applied:
        cimgraph_patch.apply()
    yield
    if not was_applied:
        cimgraph_patch.revert()


def _parse_fingerprint():
    """A hash of everything a parse produces, patched or not."""
    from cimhelper import CIMHelper

    helper = CIMHelper()
    try:
        data, details = helper.cim_to_gjs(filepaths=[str(cim_model())])
        blob = json.dumps({"data": data, "objectDetails": details}, sort_keys=True).encode()
        return hashlib.sha256(blob).hexdigest()
    finally:
        helper.release()


def test_the_patch_is_installed_by_importing_cimhelper(patched):
    import cimhelper  # noqa: F401

    assert cimgraph_patch.is_applied()


def test_the_patch_changes_nothing_about_the_output(patched):
    """The whole case for this patch is that it is invisible.

    Same model, once through the library's implementation and once through the
    replacement — the parsed graph and every object detail must hash the same.
    """
    with_patch = _parse_fingerprint()

    cimgraph_patch.revert()
    try:
        without_patch = _parse_fingerprint()
    finally:
        cimgraph_patch.apply()

    assert with_patch == without_patch


def test_it_declines_when_the_library_has_changed_underneath_it(monkeypatch):
    """A cim-graph upgrade must fall back, not silently run a stale copy."""
    from cimgraph.databases import ConnectionInterface

    def reworked_upstream(self, graph, cim_class, identifier, attribute, edge_class, edge_mRID):
        return None

    was_applied = cimgraph_patch.revert()
    monkeypatch.setattr(ConnectionInterface, "create_edge", reworked_upstream)
    monkeypatch.setattr(cimgraph_patch, "_applied", False)
    try:
        assert cimgraph_patch.apply() is False
        assert ConnectionInterface.create_edge is reworked_upstream
    finally:
        monkeypatch.undo()
        if was_applied:
            cimgraph_patch.apply()


def test_it_can_be_switched_off_without_a_code_change(monkeypatch):
    monkeypatch.setenv("GLIMPSE_CIMGRAPH_PATCH", "0")
    was_applied = cimgraph_patch.revert()
    monkeypatch.setattr(cimgraph_patch, "_applied", False)
    try:
        assert cimgraph_patch.apply() is False
    finally:
        monkeypatch.undo()
        if was_applied:
            cimgraph_patch.apply()


def test_applying_twice_is_harmless(patched):
    from cimgraph.databases import ConnectionInterface

    first = ConnectionInterface.create_edge
    assert cimgraph_patch.apply() is True
    assert ConnectionInterface.create_edge is first
