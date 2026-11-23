import { DEFAULT_STYLES } from "sigma";
import { layerFill, layerPlain, pathCurved, pathLine, sdfCircle } from "sigma/rendering";
import { layerImage } from "@sigma/node-image";
import { layerBorder } from "@sigma/node-border";
import {
    LABEL_SIZE,
    hoverBackgroundColor,
    nodeCard,
    labelBackgroundColor,
    textColor,
} from "../../utils/canvas-utils";
import graphHelper from "../../graph-helper/GraphHelper";
import { sizeRatioExponent } from "../../graph-helper/zoom-scaling";
import { EDGE_OVERLAY_DEPTH } from "../../custom-programs/edge-overlays";
import { isViolation } from "../../utils/electrical";
import { FOCUS_COLOR } from "../../graph-helper/edge-focus";


const INACTIVE_COLOR = "rgba(145, 145, 145, 0.7)";

// Violation mode recolors by electrical condition instead of object type.
// Violating objects are also enlarged so they're findable without hunting: on a
// 9500-node feeder a color change alone is easy to miss when zoomed out.
const VIOLATION_NODE_SCALE = 2.2;
const VIOLATION_EDGE_SCALE = 2.5;

const violationNodeAttrs = (attrs, severity) => ({
    ...attrs,
    color: severity.color,
    borderColor: severity.color,
    // Drop the pictogram: the type-specific icon competes with the condition
    // color, which is the only thing this mode is meant to communicate.
    type: "node",
    image: "",
    size: isViolation(severity) ? attrs.size * VIOLATION_NODE_SCALE : attrs.size,
    zIndex: isViolation(severity) ? 10 : 0,
});

const violationEdgeAttrs = (attrs, severity) => {
    const violating = isViolation(severity);
    const base = {
        ...attrs,
        color: severity.color,
        size: violating ? attrs.size * VIOLATION_EDGE_SCALE : attrs.size,
        zIndex: violating ? 10 : 0,
    };
    // Keep icon edges drawing their symbol, but in the condition color.
    if (attrs.iconType === "switch") return { ...base, switchColor: severity.color };
    if (attrs.iconType === "regulator") return { ...base, regulatorColor: severity.color };
    if (attrs.iconType === "transformer") return { ...base, transformerColor: severity.color };
    return base;
};

// Grey out a node (used when it falls outside the highlighted groups/areas).
const dimNodeAttrs = (attrs, color = INACTIVE_COLOR) => ({
    ...attrs,
    color,
    borderColor: color,
    type: "node",
    label: "",
    image: "",
});

// Grey out an edge, dimming its icon too.
const dimEdgeAttrs = (attrs, color = INACTIVE_COLOR) => {
    const base = { ...attrs, color, label: "", size: 1 };
    if (attrs.iconType === "switch") return { ...base, switchColor: color, switchSize: 2 };
    if (attrs.iconType === "regulator") return { ...base, regulatorColor: color };
    if (attrs.iconType === "transformer") return { ...base, transformerColor: color };
    return base;
};

const nodeReducer = (nodeId, _data, attrs) => {
    if (graphHelper.graph.order === 0) return attrs;

    // Condition coloring replaces type coloring outright — mixing the two
    // would leave the user unsure which scale a color belongs to.
    if (graphHelper.isViolationMode()) {
        return violationNodeAttrs(attrs, graphHelper.getNodeSeverity(nodeId));
    }

    // Cut off by an open switch during a run.
    if (graphHelper.isNodeDeenergized(nodeId)) return dimNodeAttrs(attrs, graphHelper.getInactiveColor());

    // Distribution-area highlighting takes precedence: grey out any node that
    // is not in a selected area. Members keep their styling (the colored
    // contour hull marks them); nesting is handled in isInHighlightedArea.
    if (graphHelper.getHighlightedAreas().length > 0) {
        return graphHelper.isInHighlightedArea(attrs) ? attrs : dimNodeAttrs(attrs);
    }

    const noGroups = graphHelper.getHighlightedGroups().length === 0;
    if (noGroups && graphHelper.getHighlightedEdgeTypes().length === 0) return attrs;

    // With only edge types highlighted, every node dims.
    if (noGroups || !graphHelper.isHighlighted(attrs.group)) return dimNodeAttrs(attrs);

    return { ...attrs, size: attrs.size * 2 };
};

const edgeReducer = (edgeId, _data, attrs, state) => {
    // Searched/focused edge always wins: pulse it and keep it on top —
    // never dim it, whatever the area/group highlight state is.
    const focusStyle = graphHelper.getFocusedEdgeStyle(edgeId, attrs);
    if (focusStyle) return focusStyle;

    // Marks which edge the EdgeHoverCard is describing. Lives here, not in
    // `styles`: sigma spreads the reducer's output over the style result.
    if (state.isHovered) {
        return { ...attrs, color: FOCUS_COLOR, size: Math.max(3, (attrs.size || 1) * 2.5), depth: "topEdges" };
    }

    // Condition coloring replaces type coloring outright (see the node
    // reducer). The flow-animation type is left alone so dots still move.
    if (graphHelper.isViolationMode()) {
        return violationEdgeAttrs(attrs, graphHelper.getEdgeSeverity(edgeId));
    }

    if (graphHelper.isEdgeDeenergized(edgeId)) return dimEdgeAttrs(attrs, graphHelper.getInactiveColor());

    if (graphHelper.getHighlightedAreas().length > 0) {
        return graphHelper.isInHighlightedArea(attrs) ? attrs : dimEdgeAttrs(attrs);
    }

    if (
        graphHelper.getHighlightedEdgeTypes().length === 0 &&
        graphHelper.getHighlightedGroups().length === 0
    ) {
        return attrs;
    }

    if (!graphHelper.isHighlighted(attrs.group)) return dimEdgeAttrs(attrs);

    return { ...attrs, size: attrs.size * 1.5 };
};

// The reducers above stay the source of truth and return graph attributes, which
// sigma merges over what these styles produce. The styles only translate the
// attributes sigma no longer reads by itself (`hidden`, `highlighted`).
const hiddenStyle = { when: (attrs) => attrs.hidden, then: "hidden", else: "visible" };

// Module-level so its identity never changes: react-sigma tears down and
// rebuilds the Sigma instance (reloading the graph and resetting the camera)
// whenever the options object does.
export const OPTIONS = {
    settings: {
        allowInvalidContainer: true,
        minCameraRatio: 0.02,
        maxCameraRatio: null,
        renderEdgeLabels: true,
        itemSizesReference: "screen", // sizes in screen px; pairs with zoomToSizeRatioFunction
        autoRescale: true,
        doubleClickTimeout: 300,
        doubleClickZoomingRatio: 2.2,
        doubleClickZoomingDuration: 200,
        inertiaDuration: 200,
        // Reads the order per call: the graph is swapped under a stable options object.
        zoomToSizeRatioFunction: (ratio) => Math.pow(ratio, sizeRatioExponent(graphHelper.graph.order)),
        inertiaRatio: 3,
        cameraPanBoundaries: null,
        zoomDuration: 250,
        zoomingRatio: 1.5,
        labelDensity: 0.7,
        labelGridCellSize: 80,
        labelRenderedSizeThreshold: 8,
        hideEdgesOnMove: false,
        hideLabelsOnMove: true,
        enableEdgeEvents: true,
        enableNodeDrag: true, // fixed nodes opt out in GraphEvents' nodeDragStart
    },
    primitives: {
        depthLayers: ["areas", "edges", "topEdges", EDGE_OVERLAY_DEPTH, "nodes", "topNodes"],
        nodes: {
            shapes: [sdfCircle()],
            // One program for every node: the image layer is transparent without an
            // `image`, and the border layer (its own fill included) switches itself
            // off when the border is thinner than a pixel, hence the plain fill under it.
            layers: [
                layerFill(),
                layerBorder({
                    borders: [
                        { size: { attribute: "borderSize", default: 0.1 }, color: { attribute: "borderColor" } },
                        { size: 0, color: { attribute: "color" }, fill: true },
                    ],
                }),
                layerImage(),
            ],
            labelAttachments: { card: (ctx) => nodeCard(ctx, graphHelper.getNodeVitals(ctx.node)) },
        },
        edges: {
            paths: [pathLine(), pathCurved()],
            layers: [layerPlain()],
        },
    },
    styles: {
        nodes: [
            DEFAULT_STYLES.nodes,
            {
                visibility: hiddenStyle,
                // Pictogram nodes are borderless, as they were under sigma v3.
                borderSize: (attrs) => (attrs.type === "nodeImg" ? 0 : 0.1),
                labelPosition: "below",
                labelSize: LABEL_SIZE,
                labelColor: textColor,
                labelBackgroundColor,
                backdropColor: hoverBackgroundColor,
            },
            {
                when: (attrs, state) => attrs.highlighted || state.isHovered,
                then: {
                    depth: "topNodes",
                    labelVisibility: "visible",
                    backdropVisibility: "visible",
                },
            },
            // Sigma drops a node's cached attachment on every attribute change, so a
            // card would re-render on every drag frame; show just the name instead.
            {
                when: (attrs, state) => (attrs.highlighted || state.isHovered) && !state.isDragged,
                then: { labelAttachment: "card" },
            },
        ],
        edges: [
            DEFAULT_STYLES.edges,
            {
                visibility: hiddenStyle,
                label: (attrs, state) => state.hoverLabel ?? attrs.label, // set by GraphEvents
                labelColor: textColor,
                // Parallel edges fan out as curves; an animated one stays straight
                // because its flow dots travel the chord.
                parallelPath: (attrs) => (attrs.type === "animated" ? "straight" : "curved"),
            },
        ],
    },
    nodeReducer,
    edgeReducer,
};
