import { MultiUndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import circlepack from "graphology-layout/circlepack";
import { assignParallelEdgeCurvatures } from "./edge-curvature";
import { createEdge, createNode } from "./element-factory";
import { ensureEdgeOption, ensureNodeGroup } from "./theme";

const LOUVAIN_THRESHOLD = 1_000;

const bump = (counts, type) => {
    counts[type] = (counts[type] ?? 0) + 1;
};

const idOf = (attributes) => attributes.id ?? attributes.name;

// ── Pass 1: nodes ───────────────────────────────────────────────────────────

/**
 * @returns {boolean} whether any node carried coordinates from the model itself
 */
const addNodes = (graph, objects, ctx) => {
    const { theme, nodeTypes, objectTypeCount, bounds } = ctx;
    let hasFixedNodes = false;

    for (const obj of objects) {
        const attributes = obj.attributes;
        // the key at the top of the object, which can be "name" or "objectType"
        const objectType = obj.objectType ?? obj.name;
        const nodeID = idOf(attributes);

        if (nodeTypes.length > 0 && nodeTypes.includes(objectType)) {
            const positioned = "x" in attributes && "y" in attributes;
            const position = positioned
                ? { x: parseFloat(attributes.x), y: parseFloat(attributes.y) }
                : null;

            const node = createNode({
                id: nodeID,
                objectType,
                attributes,
                theme,
                position,
                fixed: positioned,
            });

            if (position) {
                growBounds(bounds, position);
                hasFixedNodes = true;
            }

            bump(objectTypeCount.nodes, objectType);

            try {
                graph.addNode(nodeID, node);
            } catch (err) {
                console.log(err);
                console.log(nodeID);
                console.log(node);
            }

            continue;
        }

        if ("elementType" in obj && obj.elementType === "node") {
            ensureNodeGroup(theme, objectType);
            if (!nodeTypes.includes(objectType)) nodeTypes.push(objectType);

            bump(objectTypeCount.nodes, objectType);
            graph.addNode(nodeID, createNode({ id: nodeID, objectType, attributes, theme }));
        }
    }

    return hasFixedNodes;
};

const growBounds = (bounds, { x, y }) => {
    if (x !== undefined && x > bounds.maxX) bounds.maxX = x;
    if (x !== undefined && x < bounds.minX) bounds.minX = x;
    if (y !== undefined && y > bounds.maxY) bounds.maxY = y;
    if (y !== undefined && y < bounds.minY) bounds.minY = y;
};

// ── Pass 2: edges ───────────────────────────────────────────────────────────

const addEdges = (graph, objects, ctx) => {
    const { theme, nodeTypes, edgeTypes, objectTypeCount } = ctx;

    for (const obj of objects) {
        const attributes = obj.attributes;
        const objectType = obj.objectType ?? obj.name;

        if (nodeTypes.includes(objectType) && "parent" in attributes) {
            const nodeID = idOf(attributes);
            const parent = attributes.parent;
            const edgeID = `${parent}->${nodeID}`;

            bump(objectTypeCount.edges, "parentChild");

            graph.addEdgeWithKey(edgeID, parent, nodeID, {
                elementType: "edge",
                group: "parentChild",
                type: "straight",
                ...theme.edgeOptions.parentChild,
                length: "length" in attributes ? parseFloat(attributes.length) : null,
                attributes: { to: parent, from: nodeID, id: edgeID },
            });

            continue;
        }

        if (edgeTypes.includes(objectType)) {
            bump(objectTypeCount.edges, objectType);
            graph.addEdgeWithKey(
                idOf(attributes),
                attributes.from,
                attributes.to,
                createEdge({ objectType, attributes, theme }),
            );

            continue;
        }

        if ("elementType" in obj && obj.elementType === "edge") {
            const edgeFrom = attributes.from;
            const edgeTo = attributes.to;
            const edgeID = attributes.id ?? `${edgeFrom}->${edgeTo}`;

            ensureEdgeOption(theme, objectType);
            bump(objectTypeCount.edges, objectType);
            if (!edgeTypes.includes(objectType)) edgeTypes.push(objectType);

            graph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, {
                elementType: "edge",
                group: objectType,
                type: "straight",
                length: attributes.length ?? null,
                ...theme.edgeOptions[objectType],
                attributes,
            });
        }
    }
};

// ── Geography, layout and placement ─────────────────────────────────────────

const detectGeoCoords = (graph, bounds, hasFixedNodes) =>
    hasFixedNodes &&
    graph.order > 0 &&
    bounds.minX >= -180 &&
    bounds.maxX <= 180 &&
    bounds.minY >= -90 &&
    bounds.maxY <= 90;

/**
 * Distribution area metadata, collected from node attributes. A node may belong
 * to several nested areas (dist_areas list); the flat dist_area_* fields are the
 * backward-compatible fallback.
 *
 * @returns {Object} { "<areaType>": [{ name, id }, ...] }
 */
const collectDistributionAreas = (graph) => {
    const areasByType = {};

    const collect = (dist_area_type, dist_area_id, dist_area_name) => {
        if (!dist_area_type || !dist_area_id) return;
        if (!areasByType[dist_area_type]) areasByType[dist_area_type] = [];
        if (areasByType[dist_area_type].some((a) => a.id === dist_area_id)) return;

        areasByType[dist_area_type].push({
            name: dist_area_name || dist_area_id,
            id: dist_area_id,
        });
    };

    graph.forEachNode((_nodeId, attrs) => {
        const attributes = attrs.attributes || {};
        const areas = attributes.dist_areas;

        if (Array.isArray(areas) && areas.length > 0) {
            areas.forEach((a) => collect(a.dist_area_type, a.dist_area_id, a.dist_area_name));
        } else {
            collect(attributes.dist_area_type, attributes.dist_area_id, attributes.dist_area_name);
        }
    });

    return areasByType;
};

const placeFloatingNodes = (graph, bounds, hasGeoCoords) => {
    const MIN_SPREAD = hasGeoCoords ? 0.01 : 500;
    const rangeX = Math.max(bounds.maxX - bounds.minX, MIN_SPREAD);
    const rangeY = Math.max(bounds.maxY - bounds.minY, MIN_SPREAD);
    const centerX = (bounds.maxX + bounds.minX) / 2;
    const centerY = (bounds.maxY + bounds.minY) / 2;

    graph.forEachNode((node, attrs) => {
        if (attrs.fixed) return;

        const anchor = graph.neighbors(node).find((n) => {
            const { x, y } = graph.getNodeAttributes(n);
            return x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y);
        });

        if (anchor) {
            const anchorAttrs = graph.getNodeAttributes(anchor);
            graph.setNodeAttribute(node, "x", anchorAttrs.x);
            graph.setNodeAttribute(node, "y", anchorAttrs.y);
        } else {
            // No valid neighbor → place randomly within bounds
            graph.setNodeAttribute(node, "x", centerX + (Math.random() - 0.05) * rangeX);
            graph.setNodeAttribute(node, "y", centerY + (Math.random() - 0.05) * rangeY);
        }

        graph.setNodeAttribute(node, "fixed", false);
    });
};

/** Initial positions for a model that ships no coordinates at all. */
const applyLayout = (graph) => {
    if (graph.order > LOUVAIN_THRESHOLD) {
        louvain.assign(graph, { nodeCommunityAttribute: "CID", resolution: 0.8 });
        circlepack.assign(graph, { hierarchyAttributes: ["CID"], scale: 1, center: 0 });
    } else {
        circlepack.assign(graph);
    }
};

const stampLatLng = (graph) => {
    graph.updateEachNodeAttributes((_node, attrs) => ({
        ...attrs,
        lng: attrs.x,
        lat: Math.max(-85, Math.min(85, attrs.y)),
    }));
};

/**
 * Builds the graph for a parsed model.
 *
 * `theme`, `nodeTypes`, `edgeTypes`, `objectTypeCount` and `bounds` are mutated
 * in place — unknown object types register themselves as they are encountered,
 * and the counts feed the legend.
 *
 * @param {Object} fileData - { "<filename>": { objects: [...] } }
 * @param {Object} ctx - { theme, nodeTypes, edgeTypes, objectTypeCount, bounds, hasFixedNodes }
 * @returns {{ graph: MultiUndirectedGraph, hasFixedNodes: boolean, hasGeoCoords: boolean,
 *            distributionAreas: Object }}
 */
export const buildGraph = (fileData, ctx) => {
    const graph = new MultiUndirectedGraph({ allowSelfLoops: true, type: "undirected" });
    const objects = Object.values(fileData).flatMap((file) => file.objects);

    const hasFixedNodes = addNodes(graph, objects, ctx) || Boolean(ctx.hasFixedNodes);
    const hasGeoCoords = detectGeoCoords(graph, ctx.bounds, hasFixedNodes);
    const distributionAreas = collectDistributionAreas(graph);

    addEdges(graph, objects, ctx);

    if (hasFixedNodes) placeFloatingNodes(graph, ctx.bounds, hasGeoCoords);
    else applyLayout(graph);

    if (hasGeoCoords) stampLatLng(graph);

    assignParallelEdgeCurvatures(graph);

    return { graph, hasFixedNodes, hasGeoCoords, distributionAreas };
};
