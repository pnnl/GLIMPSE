import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import { notify } from "../../utils/notify";

/**
 * WebGL context upkeep: tells the user when the browser takes the context away,
 * and works around two sigma render bugs (node picking, label text; see beforeRender).
 *
 * A GPU driver reset — sleep/wake, a laptop switching GPUs, or simply too much
 * pressure from a large model — drops the canvas context. Sigma keeps the
 * context restorable and rebuilds its programs (custom layers included) once
 * the browser hands it back, so all that is left to do here is say so.
 *
 * Renders nothing.
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

        // Works around sigma 4.0.6 + @sigma/node-image 4.0.2: every render, sigma binds
        // the picking texture on whichever texture unit is active, and node-image's
        // picking shader samples unit 0. When those coincide the browser rejects the
        // nodes' picking draw and node hover/click dies after a pan or zoom. Parking
        // the active unit on one nothing samples keeps the two apart.
        // Works around sigma 4.0.6 label buffers: node (and edge) label text shares one
        // buffer that each depth refills only on frames flagged dirty, so once labels
        // span two depths (a hovered node sits in topNodes) the next clean frame draws
        // the last depth's labels everywhere and every other label loses its text.
        // Refilling every frame costs only the labels on screen.
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
