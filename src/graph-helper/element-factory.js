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

export const EDGE_ICONS = {
    switch: { type: "switch", iconType: "switch", switchSize: 8, switchColor: "#E04A1F" },
    regulator: { type: "regulator", iconType: "regulator", regulatorSize: 16 },
    transformer: { type: "transformer", iconType: "transformer", transformerSize: 16 },
};

export const edgeIconFor = (objectType, attributes = {}) => {
    if (objectType === "transformer" && attributes?.class_type === "regulator") {
        return EDGE_ICONS.regulator;
    }

    return EDGE_ICONS[objectType] ?? null;
};

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
