import { createEdge, createNode } from "./element-factory";
import { ensureEdgeOption, ensureNodeGroup } from "./theme";

/**
 * Applies a color/size/hidden update to a single node or edge.
 * @param {Object} graph
 * @param {Object} data - { id, elementType: "node"|"edge", updates: { color, size, hidden } }
 *   Any value in `updates` may be null/undefined to leave that property unchanged.
 * @returns {boolean} whether the update was applied
 */
export const applyUpdate = (graph, data) => {
    if (!data || typeof data !== "object") {
        console.warn("[GraphHelper] update: invalid payload.", data);
        return false;
    }

    const { id, elementType, updates } = data;
    if (id === undefined || id === null || !updates || typeof updates !== "object") {
        console.warn("[GraphHelper] update: payload needs 'id' and an 'updates' object.", data);
        return false;
    }

    let setAttr;
    if (elementType === "node") {
        if (!graph.hasNode(id)) {
            console.warn(`[GraphHelper] update: node "${id}" not found.`);
            return false;
        }
        setAttr = (key, value) => graph.setNodeAttribute(id, key, value);
    } else if (elementType === "edge") {
        if (!graph.hasEdge(id)) {
            console.warn(`[GraphHelper] update: edge "${id}" not found.`);
            return false;
        }
        setAttr = (key, value) => graph.setEdgeAttribute(id, key, value);
    } else {
        console.warn(`[GraphHelper] update: unknown elementType "${elementType}".`);
        return false;
    }

    const { color, size, hidden } = updates;
    // null / undefined means "leave this property unchanged"
    if (color !== null && color !== undefined) setAttr("color", color);
    if (size !== null && size !== undefined) setAttr("size", size);
    if (hidden !== null && hidden !== undefined) setAttr("hidden", hidden);

    return true;
};

/**
 * Adds a single node from a GLIMPSE-format object:
 *   { objectType, elementType: "node", attributes: { id|name, x?, y?, ... } }
 * @param {Object} ctx - { graph, theme, nodeTypes, objectTypeCount, bounds }
 * @returns {boolean} whether the node was added
 */
export const addNode = (ctx, obj) => {
    const { graph, theme, nodeTypes, objectTypeCount, bounds } = ctx;

    if (!obj || typeof obj !== "object" || !obj.attributes) {
        console.warn("[GraphHelper] add-node: payload must include an 'attributes' object.", obj);
        return false;
    }

    const attributes = obj.attributes;
    const objectType = obj.objectType ?? obj.name ?? "node";
    const nodeID = attributes.id ?? attributes.name;

    if (nodeID === undefined || nodeID === null) {
        console.warn("[GraphHelper] add-node: attributes must include an 'id' or 'name'.", obj);
        return false;
    }
    if (graph.hasNode(nodeID)) {
        console.warn(`[GraphHelper] add-node: node "${nodeID}" already exists.`);
        return false;
    }

    // Register a theme entry + type for previously-unseen node types
    ensureNodeGroup(theme, objectType);
    if (!nodeTypes.includes(objectType)) nodeTypes.push(objectType);

    // Place the node at the supplied coordinates, or the center of the graph
    const position = {
        x: attributes.x !== undefined ? parseFloat(attributes.x) : (bounds.maxX + bounds.minX) / 2,
        y: attributes.y !== undefined ? parseFloat(attributes.y) : (bounds.maxY + bounds.minY) / 2,
    };

    objectTypeCount.nodes[objectType] = (objectTypeCount.nodes[objectType] ?? 0) + 1;
    graph.addNode(nodeID, createNode({ id: nodeID, objectType, attributes, theme, position }));

    return true;
};

/**
 * Adds a single edge from a GLIMPSE-format object:
 *   { objectType, elementType: "edge", attributes: { id?, from, to, ... } }
 * Both endpoint nodes must already exist.
 * @param {Object} ctx - { graph, theme, edgeTypes, objectTypeCount }
 * @returns {boolean} whether the edge was added
 */
export const addEdge = (ctx, obj) => {
    const { graph, theme, edgeTypes, objectTypeCount } = ctx;

    if (!obj || typeof obj !== "object" || !obj.attributes) {
        console.warn("[GraphHelper] add-edge: payload must include an 'attributes' object.", obj);
        return false;
    }

    const objectType = obj.objectType ?? obj.name ?? "edge";
    const fromNode = obj.attributes.from;
    const toNode = obj.attributes.to;
    const edgeID = obj.attributes.id ?? `${fromNode}->${toNode}`;

    if (fromNode === undefined || toNode === undefined) {
        console.warn("[GraphHelper] add-edge: attributes must include 'from' and 'to'.", obj);
        return false;
    }
    if (!graph.hasNode(fromNode) || !graph.hasNode(toNode)) {
        console.warn(`[GraphHelper] add-edge: both endpoints "${fromNode}" and "${toNode}" must exist.`);
        return false;
    }
    if (graph.hasEdge(edgeID)) {
        console.warn(`[GraphHelper] add-edge: edge "${edgeID}" already exists.`);
        return false;
    }

    ensureEdgeOption(theme, objectType);
    if (!edgeTypes.includes(objectType)) edgeTypes.push(objectType);

    const attributes = { ...obj.attributes, id: edgeID, from: fromNode, to: toNode };
    objectTypeCount.edges[objectType] = (objectTypeCount.edges[objectType] ?? 0) + 1;
    graph.addEdgeWithKey(edgeID, fromNode, toNode, createEdge({ objectType, attributes, theme }));

    return true;
};

/** Unwraps an id that may have been sent as `id`, or as `{ id }` / `{ nodeID }`. */
const unwrapId = (payload, altKey) =>
    typeof payload === "object" && payload !== null ? (payload.id ?? payload[altKey]) : payload;

/**
 * Removes a node (and its attached edges).
 * @param {Object} ctx - { graph, objectTypeCount }
 * @returns {boolean} whether the node was removed
 */
export const deleteNode = ({ graph, objectTypeCount }, nodeID) => {
    const id = unwrapId(nodeID, "nodeID");

    if (!graph.hasNode(id)) {
        console.warn(`[GraphHelper] delete-node: node "${id}" not found.`);
        return false;
    }

    const group = graph.getNodeAttribute(id, "group");

    // Keep edge type counts honest by tallying the edges dropNode will remove
    graph.forEachEdge(id, (_edge, attrs) => {
        if (attrs.group && objectTypeCount.edges[attrs.group] > 0) objectTypeCount.edges[attrs.group]--;
    });

    graph.dropNode(id); // also removes attached edges
    if (group && objectTypeCount.nodes[group] > 0) objectTypeCount.nodes[group]--;

    return true;
};

/**
 * Removes an edge.
 * @param {Object} ctx - { graph, objectTypeCount }
 * @returns {boolean} whether the edge was removed
 */
export const deleteEdge = ({ graph, objectTypeCount }, edgeID) => {
    const id = unwrapId(edgeID, "edgeID");

    if (!graph.hasEdge(id)) {
        console.warn(`[GraphHelper] delete-edge: edge "${id}" not found.`);
        return false;
    }

    const group = graph.getEdgeAttribute(id, "group");
    graph.dropEdge(id);
    if (group && objectTypeCount.edges[group] > 0) objectTypeCount.edges[group]--;

    return true;
};
