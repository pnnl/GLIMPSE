// How drawn items respond to zoom, shared by the graph renderer and the
// distribution-area contour layer so the two keep the same proportions.
//
// Sigma divides an item's size by `zoomToSizeRatioFunction(cameraRatio)`, so with
// an exponent of 1 an item is glued to the graph (zoom 10x, item draws 10x
// bigger) and with 0 it holds a fixed pixel size. Big models use a low exponent:
// zooming into a 5000-node feeder is how you separate the detail, and items that
// grew with the graph would just cover it back up.

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
