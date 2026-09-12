import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import { bindWebGLLayer } from "@sigma/layer-webgl";
import graphHelper from "../../graph-helper/GraphHelper";
import useAreaHighlight from "../../hooks/useAreaHighlight";
import { buildAreaContourGeometry, computeContourRadius } from "../../graph-helper/area-contour";
import { graphSizeZoomExponent } from "../../graph-helper/zoom-scaling";
import createAreaContourProgram from "../../custom-programs/area-contour-program/AreaContourProgram";

// The fill sits under the edges, so it stays light enough to read the network
// through it and to tell two overlapping areas apart; the outline is what
// actually delineates the area. Alphas are appended to the area's hex color.
export const FILL_ALPHA = "66"; // 40%
export const BORDER_ALPHA = "E6"; // 90%
const BORDER_WIDTH = 1.5; // css pixels

/**
 * Draws the halo around every selected distribution area, and flies the camera
 * to cover them.
 *
 * Renders nothing itself. It exists as its own component so exactly one place
 * binds the WebGL layers: the selection is driven from the area tree, the agent
 * markers and the agents view, and a second binder would leak layers and exhaust
 * the WebGL context. Mounted once, inside the SigmaContainer.
 */
const AreaHighlightLayers = () => {
    const sigma = useSigma();
    const { selection, colors } = useAreaHighlight();

    useEffect(() => {
        if (!sigma || selection.length === 0) return;

        // Colors are assigned by the controller at selection time, so they are
        // always ready by the time this effect runs.
        const areasToRender = selection.filter((id) => colors[id]);

        // Raise the listener cap so sigma doesn't warn on many simultaneous layers
        sigma.setMaxListeners(areasToRender.length + 10);

        // One halo thickness for the whole model, so areas shown together read as
        // the same kind of thing however densely each one is wired. It tightens
        // as you zoom in on the same curve node sizes follow, which is what keeps
        // the halo off the detail you zoomed in to see on a large feeder.
        const radius = computeContourRadius(graphHelper.graph, sigma);
        const zoomExponent = graphSizeZoomExponent(graphHelper.graph.order);

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        const cleanups = areasToRender.flatMap((areaId) => {
            const geometry = buildAreaContourGeometry(graphHelper.graph, sigma, areaId);

            if (!geometry) return [];

            const { segments, bounds } = geometry;
            minX = Math.min(minX, bounds.minX);
            maxX = Math.max(maxX, bounds.maxX);
            minY = Math.min(minY, bounds.minY);
            maxY = Math.max(maxY, bounds.maxY);

            const color = colors[areaId];

            try {
                const cleanup = bindWebGLLayer(
                    `dist-area-${areaId}`,
                    sigma,
                    createAreaContourProgram(segments, {
                        radius,
                        zoomExponent,
                        fill: `${color}${FILL_ALPHA}`,
                        border: { color: `${color}${BORDER_ALPHA}`, width: BORDER_WIDTH },
                    }),
                );
                return [cleanup];
            } catch (err) {
                console.error(`[WebGL] Failed to create layer for area ${areaId}:`, err);
                return [];
            }
        });

        // Camera: animate to the highlighted areas, halo included
        if (minX < Infinity) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const spread = Math.max(maxX - minX, maxY - minY) + 2 * radius;
            const ratio = Math.min(5, Math.max(0.05, spread * 1.15));
            sigma.getCamera().animate({ x: centerX, y: centerY, ratio }, { duration: 800 });
        }

        return () => cleanups.forEach((fn) => fn());
    }, [selection, colors, sigma]);

    // Drive the reducer grey-out: the controller already pushed the selection
    // into graphHelper, so this only has to ask sigma to repaint with it.
    useEffect(() => {
        if (sigma) sigma.refresh();
    }, [selection, sigma]);

    return null;
};

export default AreaHighlightLayers;
