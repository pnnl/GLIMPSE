import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";

const AnimatedEdgeTicker = () => {
    const sigma = useSigma();

    useEffect(() => {
        const RECHECK_MS = 250;
        let frameId;
        let running = true;
        let wasPulsing = false;
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
                sigma.refresh({ skipIndexation: true });
            } else if (pulsing) {
                sigma.refresh({ partialGraph: { edges: [pulseId] }, skipIndexation: true });
            } else if (wasPulsing && pulseId && graph.hasEdge(pulseId)) {
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
