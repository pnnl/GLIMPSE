import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";

const AnimatedEdgeTicker = () => {
    const sigma = useSigma();

    useEffect(() => {
        let frameId;
        let running = true;

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

            if (hasAnimatedEdges()) {
                sigma.refresh({ skipIndexation: true });
            }

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
