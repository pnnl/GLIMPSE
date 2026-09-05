import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";

const AnimatedEdgeTicker = () => {
    const sigma = useSigma();

    useEffect(() => {
        let frameId;
        let running = true;
        let wasPulsing = false;

        // Whether any edge is animated is a whole-graph question, and asking it
        // every frame cost a full edge scan 60x a second forever — ~20k
        // iterations per frame on a 9500-bus feeder, with or without a running
        // simulation. findEdge short-circuits on the first hit, and the answer is
        // cached between checks: edges start and stop animating on simulation
        // output, so resolving that a fraction of a second late is not visible.
        const RECHECK_MS = 250;
        let cachedHasAnimated = false;
        let checkedAt = 0;

        const hasAnimatedEdges = (now) => {
            if (now - checkedAt >= RECHECK_MS) {
                checkedAt = now;
                cachedHasAnimated = Boolean(
                    sigma.getGraph().findEdge((edge, attrs) => attrs.type === "animated"),
                );
            }
            return cachedHasAnimated;
        };

        const animate = (now) => {
            if (!running) return;

            const graph = sigma.getGraph();
            const pulseId = graphHelper.getFocusedEdgeId();
            const pulsing = Boolean(
                graphHelper.isFocusPulseActive() && pulseId && graph.hasEdge(pulseId),
            );

            if (hasAnimatedEdges(now)) {
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
