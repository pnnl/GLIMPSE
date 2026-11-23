import { useEffect } from "react";
import { useRegisterEvents, useSigma } from "@react-sigma/core";
import graphHelper from "../../graph-helper/GraphHelper";
import { formatPercent } from "../../utils/electrical";

// Edges have no hover card (sigma only draws one for nodes), so their live
// loading rides along on the hover label — the one place it can surface on the
// canvas itself. Falls back to just the name outside a simulation.
const edgeHoverLabel = (edgeId) => {
    const attrs = graphHelper.graph.getEdgeAttributes(edgeId);
    const name = attrs.attributes?.name ?? edgeId;

    const loading = graphHelper.getEdgeLoadingSummary(edgeId);
    if (loading?.ratio == null) return name;

    return `${name} · ${formatPercent(loading.ratio)} loaded`;
};

/**
 * Registers the read-only canvas interactions (bbox pin, drag, hover labels,
 * focus clearing) plus any `extraHandlers`. `extraHandlers` must be stable
 * (built once per sigma instance) or the handlers re-register every render.
 */
export const useExploreEvents = (extraHandlers) => {
    const sigma = useSigma();
    const registerEvents = useRegisterEvents();

    // Pin the camera to the graph's own bounds on the first render so sigma stops
    // autoscaling as nodes move. Deliberately its own effect: a raw sigma.on has
    // no automatic cleanup (unlike registerEvents), so living in the drag effect
    // below re-added a listener on every drag and stacked them
    // until sigma's emitter warned about a leak.
    useEffect(() => {
        const pinBBoxOnce = () => {
            if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
        };

        sigma.on("afterRender", pinBBoxOnce);
        return () => {
            sigma.off("afterRender", pinBBoxOnce);
        };
    }, [sigma]);

    useEffect(() => {
        // Sigma state, not a graph attribute: any edge attribute write makes sigma
        // reprocess the whole graph, while a state change restyles just that edge.
        // GraphRenderer's edge style reads `hoverLabel`.
        const showEdgeLabel = (edgeId) => sigma.setEdgeState(edgeId, { hoverLabel: edgeHoverLabel(edgeId) });
        const hideEdgeLabel = (edgeId) => sigma.setEdgeState(edgeId, { hoverLabel: null });
        const { mousedown: extraMousedown, ...rest } = extraHandlers ?? {};

        registerEvents({
            // Sigma's own drag: it moves the node, keeps it hovered and flags it
            // `isDragged` (GraphRenderer hides the card on that state).
            nodeDragStart: (e) => {
                // Model-placed nodes stay put (the press pans instead); left button only.
                if (graphHelper.graph.getNodeAttribute(e.node, "fixed") || e.event.original.buttons !== 1) {
                    e.preventSigmaDefault();
                    return;
                }

                document.body.style.cursor = "grabbing";
                // Sigma counts a node drag as camera movement, and hideLabelsOnMove
                // would blank every label for the whole drag.
                sigma.setSetting("hideLabelsOnMove", false);
            },
            nodeDragEnd: () => {
                document.body.style.cursor = "";
                sigma.setSetting("hideLabelsOnMove", true);
            },
            mousedown: (e) => {
                // The focused node can be gone (model reloaded, node deleted) by now.
                const focused = graphHelper.focusedNode;
                if (focused && graphHelper.graph.hasNode(focused)) {
                    graphHelper.graph.setNodeAttribute(focused, "highlighted", false);
                }
                graphHelper.focusedNode = null;

                extraMousedown?.(e);
            },
            enterNode: (e) => {
                const edges = graphHelper.graph.edges(e.node);
                if (edges.length <= 10) edges.forEach(showEdgeLabel);
            },
            leaveNode: (e) => graphHelper.graph.edges(e.node).forEach(hideEdgeLabel),
            enterEdge: (e) => showEdgeLabel(e.edge),
            leaveEdge: (e) => hideEdgeLabel(e.edge),
            ...rest,
        });
    }, [sigma, registerEvents, extraHandlers]);
};
