import AnimatedDotProgram from "./animated-dot-program/AnimatedDotProgram";
import SwitchSquareProgram from "./switch-program/SwitchSquareProgram";
import RegulatorProgram from "./regulator-program/RegulatorProgram";
import TransformerProgram from "./transformer-program/TransformerProgram";

const PROGRAMS = {
    animated: AnimatedDotProgram,
    switch: SwitchSquareProgram,
    regulator: RegulatorProgram,
    transformer: TransformerProgram,
};

const LAYER_ID = "edge-overlays";
export const EDGE_OVERLAY_DEPTH = "edgeOverlays";

// Attribute changes sigma may repaint in place, without the reprocess that
// reaches a custom layer's cacheData.
const IN_PLACE_GRAPH_EVENTS = [
    "nodeAttributesUpdated",
    "edgeAttributesUpdated",
    "eachNodeAttributesUpdated",
    "eachEdgeAttributesUpdated",
];

/**
 * Draws the edge icons and flow dots just above the edges. They are wider than
 * the line, so they can't be sigma edge layers, which only shade inside the edge
 * ribbon. An animated edge shows dots in place of its icon.
 *
 * The buffers are rebuilt only when something they depend on changed: refilling
 * costs ~20 ms on a 9500-node feeder, far too much to pay on every pan frame.
 *
 * @returns {{ invalidate: () => void, unbind: () => void }} `invalidate` is for
 *   changes neither the graph nor a sigma reprocess announces (reducer output
 *   that varies with time, repainted through a partial refresh).
 */
export const bindEdgeOverlays = (sigma) => {
    const graph = sigma.getGraph();
    let dirty = true;
    const invalidate = () => {
        dirty = true;
    };

    const fill = (programs) => {
        Object.values(programs).forEach((program) => program.clear());

        // Node positions straight from the graph: getNodeDisplayData copies a ~50-field
        // object per call, which made up most of a refill's cost on a large feeder.
        // shortcut: assumes node position and visibility come only from the x/y/hidden
        // attributes; read display data again if a reducer ever moves or hides nodes.
        const toFramed = sigma.getNormalizationFunction();

        graph.forEachEdge((edge, attrs, _source, _target, sourceAttrs, targetAttrs) => {
            const program = programs[attrs.type === "animated" ? "animated" : attrs.iconType];
            if (!program || sourceAttrs.hidden || targetAttrs.hidden) return;

            const data = sigma.getEdgeDisplayData(edge);
            if (!data || data.visibility === "hidden") return;

            program.push(toFramed(sourceAttrs), toFramed(targetAttrs), { ...attrs, ...data });
        });
    };

    IN_PLACE_GRAPH_EVENTS.forEach((event) => graph.on(event, invalidate));

    sigma.addCustomLayerProgram(LAYER_ID, EDGE_OVERLAY_DEPTH, (gl) => {
        const programs = Object.fromEntries(
            Object.entries(PROGRAMS).map(([kind, EdgeProgram]) => [kind, new EdgeProgram(gl, null, sigma)]),
        );
        invalidate(); // also re-run after a context restore, with empty programs

        return {
            cacheData: invalidate, // sigma reprocessed the graph
            render(params) {
                if (dirty) {
                    dirty = false;
                    fill(programs);
                }
                Object.values(programs).forEach((program) => program.render(params));
            },
            kill: () => Object.values(programs).forEach((program) => program.kill()),
        };
    });

    return {
        invalidate,
        unbind: () => {
            IN_PLACE_GRAPH_EVENTS.forEach((event) => graph.off(event, invalidate));
            sigma.removeCustomLayerProgram(LAYER_ID);
        },
    };
};
