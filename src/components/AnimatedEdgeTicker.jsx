import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";

const AnimatedEdgeTicker = () => {
    const sigma = useSigma();

    useEffect(() => {
        let frameId;
        let running = true;
        let wasPulsing = false;

        const hasAnimatedEdges = () => {
            const graph = sigma.getGraph();
            let found = false;

            graph.forEachEdge((edge, attrs) => {
                if (attrs.type === "animated") found = true;
            });

            return found;
        };

        const animate = () => {
            if (!running) return;

            const graph = sigma.getGraph();
            const pulseId = graphHelper.getFocusedEdgeId();
            const pulsing = Boolean(
                graphHelper.isFocusPulseActive() && pulseId && graph.hasEdge(pulseId),
            );

            if (hasAnimatedEdges()) {
                // Full refresh already re-applies the pulse to the focused edge.
                sigma.refresh({ skipIndexation: true });
            } else if (pulsing) {
                // Only the focused edge changes each frame, so repaint just it.
                // Its z-order was already established by the full refresh in focus().
                sigma.refresh({ partialGraph: { edges: [pulseId] }, skipIndexation: true });
            } else if (wasPulsing && pulseId && graph.hasEdge(pulseId)) {
                // Pulse just ended — one last repaint locks in the steady emphasis
                // instead of leaving the edge frozen mid-pulse.
                sigma.refresh({ partialGraph: { edges: [pulseId] }, skipIndexation: true });
            }

            wasPulsing = pulsing;
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);

        return () => {
            running = false;
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, [sigma]);

    return null;
};

export default AnimatedEdgeTicker;
