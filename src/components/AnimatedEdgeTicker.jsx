import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";
import { bindEdgeOverlays } from "../custom-programs/edge-overlays";

const AnimatedEdgeTicker = () => {
    const sigma = useSigma();

    useEffect(() => {
        const overlays = bindEdgeOverlays(sigma);
        const RECHECK_MS = 250;
        let frameId;
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
            const graph = sigma.getGraph();
            const pulseId = graphHelper.getFocusedEdgeId();
            const pulsing = Boolean(
                graphHelper.isFocusPulseActive() && pulseId && graph.hasEdge(pulseId),
            );

            if ((pulsing || wasPulsing) && pulseId && graph.hasEdge(pulseId)) {
                // One last repaint after the pulse ends clears its final frame.
                overlays.invalidate(); // the pulse also resizes the edge's icon
                sigma.refresh({ partialGraph: { edges: [pulseId] }, skipIndexation: true });
            } else if (hasAnimatedEdges(now)) {
                // The dots move on a time uniform, so a redraw is all they need.
                sigma.scheduleRender();
            }

            wasPulsing = pulsing;
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(frameId);
            overlays.unbind();
        };
    }, [sigma]);

    return null;
};

export default AnimatedEdgeTicker;
