import json
import os

import jsonschema


class JSONHelper:
    # Keys that identify a NetworkX node-link data dump. NetworkX emits the edge
    # list under "edges" (>=3.6) or "links" (older releases), so either counts.
    _NODE_LINK_REQUIRED = ("directed", "multigraph", "nodes")

    def _load_schema(self, schema_name: str) -> dict:
        schema_path = os.path.join(os.path.dirname(__file__), "schemas", schema_name)
        with open(schema_path, "r") as f:
            return json.load(f)

    def _is_node_link_data(self, file_data) -> bool:
        """True when the payload looks like a NetworkX node-link dump."""
        if not isinstance(file_data, dict):
            return False
        has_edges = "edges" in file_data or "links" in file_data
        return has_edges and all(key in file_data for key in self._NODE_LINK_REQUIRED)

    def _node_link_to_objects(self, file_data: dict) -> list:
        """
        Convert a NetworkX node-link dict into the list of GLIMPSE objects the
        frontend expects. Handles both the "edges" (NetworkX >=3.6) and "links"
        (older) edge keys, optional multigraph "key", and non-string node ids.
        """
        objects = []

        for node in file_data.get("nodes", []):
            if "type" in node and isinstance(node["type"], dict):
                object_type = "-".join(node["type"].get("path", []))
            elif "type" in node:
                object_type = node["type"]
            else:
                object_type = "node"

            attributes = dict(node)
            # graphology keys nodes by string, so normalize the id up front
            if "id" in attributes:
                attributes["id"] = str(attributes["id"])

            objects.append(
                {
                    "objectType": object_type,
                    "elementType": "node",
                    "attributes": attributes,
                }
            )

        edge_list = file_data.get("edges")
        if edge_list is None:
            edge_list = file_data.get("links", [])

        for edge in edge_list:
            source = str(edge["source"])
            target = str(edge["target"])
            key = edge.get("key")
            edge_id = (
                f"{source}-{target}-{key}" if key is not None else f"{source}-{target}"
            )

            new_edge = {
                "objectType": edge.get("type", "edge"),
                "elementType": "edge",
                "attributes": {"id": edge_id, "from": source, "to": target},
            }

            # Carry over any remaining edge attributes (skip structural keys)
            for attr_key, val in edge.items():
                if attr_key not in ("source", "target", "key", "type"):
                    new_edge["attributes"][attr_key] = val

            objects.append(new_edge)

        return objects

    def _to_objects_format(self, data, error_prefix: str) -> dict:
        """Node-link data is converted; anything else must already match the schema."""
        if self._is_node_link_data(data):
            return {"objects": self._node_link_to_objects(data)}

        try:
            jsonschema.validate(instance=data, schema=self._load_schema("json_upload.schema.json"))
        except jsonschema.ValidationError as e:
            raise ValueError(f"{error_prefix}: {e.message}")
        return data

    def validate_json_data(self, json_data: dict) -> dict:
        return {
            file_path: self._to_objects_format(file_data, f"JSON validation error for {file_path}")
            for file_path, file_data in json_data.items()
        }

    def prepare_graph_payload(self, data) -> dict:
        if not isinstance(data, dict):
            raise ValueError("Graph payload must be a JSON object.")
        return {"socket-graph": self._to_objects_format(data, "Graph validation error")}

    def validate_json_theme(self, json_theme_filename: str) -> dict:
        with open(json_theme_filename, "r") as f:
            theme_data = json.load(f)

        try:
            jsonschema.validate(instance=theme_data, schema=self._load_schema("theme_upload.schema.json"))
            return theme_data
        except jsonschema.ValidationError as e:
            raise ValueError(f"JSON theme validation error: {e.message}")

    def split_theme(self, paths: list[str]) -> tuple[dict | None, list[str]]:
        """(validated data of the first <name>.theme.json or None, the other paths)."""
        theme_path = next((p for p in paths if os.path.basename(p).endswith(".theme.json")), None)
        theme_data = self.validate_json_theme(theme_path) if theme_path else None
        return theme_data, [p for p in paths if p != theme_path]
