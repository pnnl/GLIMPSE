import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";

const CURVED_ICON_TYPE = {
    switch: "curvedSwitch",
    regulator: "curvedRegulator",
    transformer: "curvedTransformer",
};
const ICON_PRIMARY_CURVATURE = 0.012;

const curvedTypeFor = (iconType) => (iconType ? CURVED_ICON_TYPE[iconType] : "curved");

const curvatureFor = (index, maxIndex) => {
    if (maxIndex <= 0) throw new Error("Invalid maxIndex");
    if (index < 0) return -curvatureFor(-index, maxIndex);

    const amplitude = 3.5;
    const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE;

    return (maxCurvature * index) / maxIndex;
};

/** Assigns a `type` + `curvature` to every edge that shares endpoints with another. */
export const assignParallelEdgeCurvatures = (graph) => {
    // Step 1: let the library detect which edges are parallel
    indexParallelEdgesIndex(graph, {
        edgeIndexAttribute: "parallelIndex",
        edgeMinIndexAttribute: "parallelMinIndex",
        edgeMaxIndexAttribute: "parallelMaxIndex",
    });

    // Step 2: assign type + curvature based on the indexed values
    graph.forEachEdge((edge, { parallelIndex, parallelMinIndex, parallelMaxIndex, iconType }) => {
        if (typeof parallelMinIndex === "number") {
            const curvature = curvatureFor(parallelIndex, parallelMaxIndex);

            if (iconType) {
                graph.mergeEdgeAttributes(edge, {
                    type: curvedTypeFor(iconType),
                    curvature: parallelIndex ? curvature : ICON_PRIMARY_CURVATURE,
                });
            } else {
                graph.mergeEdgeAttributes(edge, {
                    type: parallelIndex ? "curved" : "straight",
                    curvature,
                });
            }

            return;
        }

        if (typeof parallelIndex === "number") {
            graph.mergeEdgeAttributes(edge, {
                type: curvedTypeFor(iconType),
                curvature: curvatureFor(parallelIndex, parallelMaxIndex),
            });
        }
    });
};
