// Builders for the sigma attribute objects stored on graph nodes and edges.
//
// Every path that creates an element — file load, socket add-node/add-edge, the
// in-app "new object" forms — goes through here, so a node or edge looks the
// same no matter where it came from.

import { buildHoverAttributes } from "../utils/hover-attributes";

/**
 * The three fields drawHover reads. Assign onto a node's attributes to give it a
 * hover card: a colored vitals block, a filtered attribute list, and the count
 * of attributes not shown.
 *
 * @param {Object} attributes - the node's model attributes
 * @param {Array} [vitals] - from measurements.nodeVitals; empty outside a sim
 */
export const hoverPayload = (attributes, vitals = []) => {
    const { lines, hidden } = buildHoverAttributes(attributes);
    return {
        hoverVitals: vitals,
        attributesLabel: lines.join("\n"),
        attributesHidden: hidden,
    };
};

/**
 * Edges whose type is drawn by a custom WebGL program that paints a symbol at
 * the midpoint (see src/custom-programs/). `type` selects the program, and
 * `iconType` is what the rest of the app tests to know an edge carries a symbol
 * (parallel-edge curvature, the focus pulse, and the flow animation all skip or
 * special-case them).
 */
export const EDGE_ICONS = {
    switch: { type: "switch", iconType: "switch", switchSize: 8, switchColor: "#ff0000" },
    regulator: { type: "regulator", iconType: "regulator", regulatorSize: 16 },
    transformer: { type: "transformer", iconType: "transformer", transformerSize: 16 },
};

/**
 * The icon overrides for an edge type, or null when it draws as a plain line.
 * Transformers tagged `class_type: "regulator"` get the tap-changer arrow
 * instead of the plain windings.
 */
export const edgeIconFor = (objectType, attributes = {}) => {
    if (objectType === "transformer" && attributes?.class_type === "regulator") {
        return EDGE_ICONS.regulator;
    }

    return EDGE_ICONS[objectType] ?? null;
};

/** Flow-animation defaults; the dots only move once a simulation sets `type: "animated"`. */
const flowDefaults = () => ({
    dotColor: "#ff0000",
    dotSize: 6,
    dotSpeed: 0.25,
    dotPhase: Math.random(),
    flowDirection: 1, // -1 for opposite flow
    dotCount: 1,
});

/**
 * Sigma attributes for an edge.
 *
 * @param {Object} params
 * @param {string} params.objectType - the model object type; also the theme/legend group
 * @param {Object} params.attributes - the model attributes, stored verbatim under `attributes`
 * @param {Object} params.theme - the active theme (its `edgeOptions[objectType]` is spread in)
 */
export const createEdge = ({ objectType, attributes, theme }) => ({
    elementType: "edge",
    group: objectType,
    type: "straight",
    ...flowDefaults(),
    attributes,
    ...theme.edgeOptions[objectType],
    ...edgeIconFor(objectType, attributes),
});

/**
 * Sigma attributes for a node.
 *
 * @param {Object} params
 * @param {string|number} params.id
 * @param {string} params.objectType
 * @param {Object} params.attributes
 * @param {Object} params.theme - the active theme (its `groups[objectType]` is spread in)
 * @param {{x: number, y: number}|null} [params.position] - omitted for nodes the layout places
 * @param {boolean} [params.fixed] - true only when the coordinates came from the model itself,
 *   which is what pins the node against the layout algorithms
 */
export const createNode = ({ id, objectType, attributes, theme, position = null, fixed = false }) => {
    const node = {
        label: attributes.name ?? String(id),
        elementType: "node",
        group: objectType,
        attributes,
        community: attributes.dist_area_id ?? undefined,
        fixed,
        ...theme.groups[objectType],
        ...hoverPayload(attributes),
    };

    if (position) {
        node.x = position.x;
        node.y = position.y;
    }

    return node;
};
