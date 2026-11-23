import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import { notify } from "../../utils/notify";

/**
 * WebGL context upkeep: tells the user when the browser takes the context away, and works around two sigma render bugs (node picking, label text; see beforeRender).
 * Sigma restores the context and rebuilds its programs itself, so all that is left is to say so; renders nothing.
 */
// Sigma 4.0.6 assumes reducers and function styles read its graph-wide state, so
// every hover start/end restyles every node and edge (~100 ms on the 9500 model).
// Ours read only attributes, item state and graphHelper (whose changes call
// refresh() themselves), so restyling just the items whose state changed is enough.
const restyleOnlyChangedItems = (sigma) => {
    sigma.internals.nodeStyleAnalysis.dependency = "item-state";
    sigma.edgeStyleAnalysis.dependency = "item-state";
};

const WebGLRecovery = () => {
    const sigma = useSigma();

    useEffect(() => {
        const onLost = () => {
            console.warn("[webgl] context lost — waiting for restore");
            notify.warning("The graphics context was lost. Restoring the graph…");
        };
        const onRestored = () => console.warn("[webgl] context restored");

        // Works around sigma 4.0.6 + @sigma/node-image 4.0.2 picking (the active texture unit collides with node-image's unit 0, killing node hover/click after a pan or zoom) by parking the active unit on one nothing samples.
        // Also works around sigma 4.0.6 label buffers (dirty-frame-only refills draw the last depth's labels everywhere once labels span two depths) by refilling every frame, which costs only the labels on screen.
        const beforeRender = () => {
            const gl = sigma.getWebGLContext();
            gl.activeTexture(gl.TEXTURE31);
            if (sigma.labelRenderer) sigma.labelRenderer.labelsDirty = true;
        };

        restyleOnlyChangedItems(sigma);

        sigma.on("webglContextLost", onLost);
        sigma.on("webglContextRestored", onRestored);
        sigma.on("beforeRender", beforeRender);

        return () => {
            sigma.off("webglContextLost", onLost);
            sigma.off("webglContextRestored", onRestored);
            sigma.off("beforeRender", beforeRender);
        };
    }, [sigma]);

    return null;
};

export default WebGLRecovery;
