// Fanning out parallel edges so two objects connecting the same pair of buses
// don't render on top of each other.

import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";

// Curved variants of the icon programs: an icon edge that gets fanned out has to
// keep drawing its symbol, so it maps to a curved-line variant rather than to
// the plain "curved" program.
const CURVED_ICON_TYPE = {
    switch: "curvedSwitch",
    regulator: "curvedRegulator",
    transformer: "curvedTransformer",
};

// Tiny curvature for the otherwise-straight primary of an icon fan: keeps the
// whole fan in ONE curved edge type (so every icon is drawn after every line,
// i.e. on top) while staying visually straight. The curve program can't render
// an exactly-zero curvature, so this can't be 0.
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
            // ── Undirected parallel group ──
            // The edge at index 0 normally stays straight (the "primary" edge);
            // all others curve so they fan out on either side.
            const curvature = curvatureFor(parallelIndex, parallelMaxIndex);

            if (iconType) {
                // Keep every member of an icon fan in the same curved type so the
                // icons always render on top of all the fan's lines.
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
            // ── Directed parallel group (shouldn't happen in our undirected
            //    graph, but included for completeness) ──
            graph.mergeEdgeAttributes(edge, {
                type: curvedTypeFor(iconType),
                curvature: curvatureFor(parallelIndex, parallelMaxIndex),
            });
        }
    });
};
