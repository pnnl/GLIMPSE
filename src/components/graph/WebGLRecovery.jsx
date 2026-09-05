import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import { useGraph } from "../../contexts/GraphContext";
import { notify } from "../../utils/notify";

/**
 * Recovers the graph when the browser takes the WebGL context away.
 *
 * A GPU driver reset — sleep/wake, a laptop switching GPUs, or simply too much
 * pressure from a large model — drops the canvas context. Sigma does not notice,
 * so the graph goes permanently blank with no error anywhere. The default action
 * for `webglcontextlost` also prevents the context from ever being restored, so
 * it has to be cancelled before anything else can work.
 *
 * Renders nothing.
 */
const WebGLRecovery = () => {
    const sigma = useSigma();
    const { newGraphUpdate } = useGraph();

    useEffect(() => {
        const canvases = Object.values(sigma.getCanvases?.() ?? {});
        if (canvases.length === 0) return undefined;

        const onLost = (event) => {
            // Without this the context is gone for good.
            event.preventDefault();
            console.warn("[webgl] context lost — waiting for restore");
            notify.warning("The graphics context was lost. Restoring the graph…");
        };

        const onRestored = () => {
            console.warn("[webgl] context restored — rebuilding");
            // Remounting SigmaContainer rebuilds every program against the new
            // context; nothing short of that brings the renderer back.
            newGraphUpdate();
        };

        canvases.forEach((canvas) => {
            canvas.addEventListener("webglcontextlost", onLost);
            canvas.addEventListener("webglcontextrestored", onRestored);
        });

        return () => {
            canvases.forEach((canvas) => {
                canvas.removeEventListener("webglcontextlost", onLost);
                canvas.removeEventListener("webglcontextrestored", onRestored);
            });
        };
    }, [sigma, newGraphUpdate]);

    return null;
};

export default WebGLRecovery;
