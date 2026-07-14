import jsonschema
import json
import os


class JSONHelper:
    # Keys that identify a NetworkX node-link data dump. NetworkX emits the edge
    # list under "edges" (>=3.6) or "links" (older releases), so either counts.
    _NODE_LINK_REQUIRED = ("directed", "multigraph", "nodes")

    def __init__(self):
        pass

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

        # Process nodes
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

        # Process edges ("edges" in newer NetworkX, "links" in older releases)
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

    def validate_json_data(self, json_data: dict) -> dict:
        # Load the JSON schema once for the whole batch
        json_upload_schema = self._load_schema("json_upload.schema.json")

        data = {}
        for file_path, file_data in json_data.items():
            if self._is_node_link_data(file_data):
                # Transform node-link data to GLIMPSE format
                data[file_path] = {"objects": self._node_link_to_objects(file_data)}
            else:
                # Validate against the GLIMPSE JSON schema
                try:
                    jsonschema.validate(instance=file_data, schema=json_upload_schema)
                    data[file_path] = file_data
                except jsonschema.ValidationError as e:
                    raise ValueError(
                        f"JSON validation error for {file_path}: {e.message}"
                    )

        return data

    def prepare_graph_payload(self, data, name: str = "socket-graph") -> dict:
        """
        Normalize a single graph payload received over the socket "load-graph"
        event into the { <name>: { "objects": [...] } } structure that the
        frontend's setGraphData expects.

        Accepts either the GLIMPSE objects format (like socialExample.json) or a
        NetworkX node-link data dump. Raises ValueError on invalid input.
        """
        if not isinstance(data, dict):
            raise ValueError("Graph payload must be a JSON object.")

        if self._is_node_link_data(data):
            return {name: {"objects": self._node_link_to_objects(data)}}

        # Otherwise expect the GLIMPSE objects format and validate it
        json_upload_schema = self._load_schema("json_upload.schema.json")
        try:
            jsonschema.validate(instance=data, schema=json_upload_schema)
        except jsonschema.ValidationError as e:
            raise ValueError(f"Graph validation error: {e.message}")

        return {name: data}

    def validate_json_theme(self, json_theme_filename: str) -> dict:
        # Load the JSON schema
        json_theme_schema = self._load_schema("theme_upload.schema.json")

        theme_data = None
        with open(json_theme_filename, "r") as f:
            theme_data = json.load(f)

        try:
            jsonschema.validate(instance=theme_data, schema=json_theme_schema)
            return theme_data
        except jsonschema.ValidationError as e:
            raise ValueError(f"JSON theme validation error: {e.message}")

    def is_theme_file(self, filename):
        """Check if filename matches <filename>.theme.json pattern"""
        parts = filename.split(".")
        return len(parts) >= 3 and parts[-2] == "theme" and parts[-1] == "json"

    def get_theme_filename(self, paths: list[str]) -> str | None:
        for path in paths:
            if self.is_theme_file(os.path.basename(path)):
                return path
        return None
