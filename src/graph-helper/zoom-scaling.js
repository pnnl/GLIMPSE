const LARGE_GRAPH_ORDER = 1000;

/** @param {number} order - node count of the graph being drawn */
export const sizeRatioExponent = (order) => (order > LARGE_GRAPH_ORDER ? 0.2 : 0.6);

/**
 * The same response, expressed for something sized in graph coordinates rather
 * than screen pixels: multiply the graph-space size by `cameraRatio ** exponent`.
 * 0 keeps it glued to the graph, 1 holds a fixed pixel size.
 *
 * @param {number} order - node count of the graph being drawn
 */
export const graphSizeZoomExponent = (order) => 1 - sizeRatioExponent(order);
