// Legend data for the object types actually present in the loaded model.
//
// Driven entirely by `objectTypeCount`, which the graph builder and the socket
// add/delete paths keep up to date. Consumed by the DOM legend panel
// (components/legend/LegendPanel.jsx).

/** The types with at least one instance in the model. */
const presentTypes = (counts) =>
    Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([type]) => type);

/**
 * Only types actually present in the model, each with its themed color so the
 * panel can render swatches without reaching into the theme itself.
 *
 * @returns {{ nodes: Array<{type, count, color, borderColor}>,
 *             edges: Array<{type, count, color}> }}
 */
export const legendEntries = (theme, objectTypeCount) => {
    const nodes = presentTypes(objectTypeCount.nodes).map((type) => ({
        type,
        count: objectTypeCount.nodes[type],
        color: theme.groups?.[type]?.color ?? "#888888",
        borderColor: theme.groups?.[type]?.borderColor ?? "#00000033",
    }));

    const edges = presentTypes(objectTypeCount.edges).map((type) => ({
        type,
        count: objectTypeCount.edges[type],
        color: theme.edgeOptions?.[type]?.color ?? "#888888",
    }));

    return { nodes, edges };
};
