"""A targeted speed patch for cimgraph's edge construction.

cimgraph builds a model by calling `ConnectionInterface.create_edge` once per
association in the file. When the association is list-valued it dedupes before
appending:

    if not any(x is edge_object for x in obj_list):

That scan is linear in the list's current length, so filling a list of n edges
costs O(n^2). It goes unnoticed on small models and dominates on large ones:
loading IEEE 9500 runs that generator expression 102,646,261 times, which is the
single largest block of self time in the whole parse.

Replacing the scan with a set of object ids makes each append O(1) and takes
about a quarter off the load, with byte-identical output. Nothing else about the
library's behaviour changes.

This is a monkeypatch on a third-party library, so it is deliberately cautious:

  * It verifies the code it is replacing still looks the way it did when this
    was written, and declines to patch if not. A cim-graph upgrade that reworks
    create_edge therefore falls back to the library's own implementation rather
    than silently running a stale reimplementation of it.
  * It can be switched off at runtime with GLIMPSE_CIMGRAPH_PATCH=0, without a
    redeploy.
  * The dedup state lives on the container object, not in a side table keyed by
    id(). An id is only unique among live objects, so a side table can hand a
    stale set to a new object that happens to reuse a collected one's address —
    which would silently drop edges. Storing it on the object gives it exactly
    the right lifetime.

The proper home for this is upstream in cim-graph; it helps every consumer, not
just GLIMPSE. Until then, this keeps the fix in one reviewable place.
"""

from __future__ import annotations

import inspect
import os
from uuid import UUID

# The line this patch exists to replace. If it is gone, the function has been
# reworked and this patch must not be applied.
_EXPECTED_MARKER = "if not any(x is edge_object for x in obj_list):"

# Where the per-object dedup sets live. Two trailing underscores, so Python's
# private-name mangling leaves it alone, and it matches the library's own
# instance attributes (__uuid__, __json_ld__).
_EDGE_CACHE_ATTR = "__glimpse_edge_ids__"

_applied = False
# Bound to cimgraph's logger when the patch is installed.
_log = None
# The implementation replaced, so it can be put back.
_original = None


def _patched_create_edge(self, graph, cim_class, identifier, attribute, edge_class, edge_mRID):
    """create_edge with O(1) membership instead of an O(n) scan.

    Mirrors the original exactly apart from the dedup, including the identifier
    normalization and the non-list branch.
    """
    # Normalize identifier to UUID so it matches the key stored by create_object.
    if isinstance(identifier, str):
        try:
            identifier = UUID(identifier.strip("_").lower())
        except ValueError:
            pass

    edge_object = None
    association = self.check_attribute(cim_class, attribute)
    if association is None:
        return None

    if association not in cim_class.__dataclass_fields__:
        _log.warning(f"{cim_class.__name__} does not have attribute {association}")
        return None

    container = graph[cim_class][identifier]
    attribute_type = cim_class.__dataclass_fields__[association].type

    if "List" in attribute_type or "list" in attribute_type:
        obj_list = getattr(container, association)
        if type(obj_list) is not list:
            obj_list = [obj_list]
        edge_object = self.create_object(graph, edge_class, edge_mRID)

        cache = getattr(container, _EDGE_CACHE_ATTR, None)
        if cache is None:
            cache = {}
            setattr(container, _EDGE_CACHE_ATTR, cache)

        seen = cache.get(association)
        # Rebuilt whenever the set and the list disagree on size, which is how
        # this stays correct if anything outside the parse mutates the list
        # (removing an object, say). The ids are only ever those of objects the
        # list itself holds, so none of them can be reused while cached.
        if seen is None or len(seen) != len(obj_list):
            seen = cache[association] = {id(x) for x in obj_list}

        if id(edge_object) not in seen:
            seen.add(id(edge_object))
            obj_list.append(edge_object)
            setattr(container, association, obj_list)
    else:
        edge_object = self.create_object(graph, edge_class, edge_mRID)
        setattr(container, association, edge_object)

    return edge_object


def apply() -> bool:
    """Install the patch. Returns whether it is now in effect.

    Safe to call more than once; only the first call does anything.
    """
    global _applied, _log, _original

    if _applied:
        return True

    if os.environ.get("GLIMPSE_CIMGRAPH_PATCH", "1").strip().lower() in ("0", "false", "no"):
        return False

    from cimgraph.databases import ConnectionInterface
    from cimgraph.databases import _log as cimgraph_log

    try:
        source = inspect.getsource(ConnectionInterface.create_edge)
    except (OSError, TypeError):
        # No source to check (installed as a zip, already patched by something
        # else). Don't guess.
        return False

    if _EXPECTED_MARKER not in source:
        cimgraph_log.warning(
            "GLIMPSE: cimgraph.create_edge no longer matches the version this "
            "patch was written against; leaving the library implementation in "
            "place. Re-check whether the patch is still needed."
        )
        return False

    _log = cimgraph_log
    _original = ConnectionInterface.create_edge
    ConnectionInterface.create_edge = _patched_create_edge
    _applied = True
    return True


def revert() -> bool:
    """Put the library's own implementation back. Returns whether it was on.

    Exists so the patch can be taken out of the picture without restarting —
    when comparing against stock behaviour, or if it is ever suspected of
    causing something.
    """
    global _applied, _original

    if not _applied:
        return False

    from cimgraph.databases import ConnectionInterface

    ConnectionInterface.create_edge = _original
    _original = None
    _applied = False
    return True


def is_applied() -> bool:
    return _applied
