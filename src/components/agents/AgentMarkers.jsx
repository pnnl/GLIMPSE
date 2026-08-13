import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSigma } from "@react-sigma/core";
import { useGraph } from "../../contexts/GraphContext";
import graphHelper from "../../graph-helper/GraphHelper";
import useAreaHighlight from "../../hooks/useAreaHighlight";
import { computeAreaCentroid } from "../../graph-helper/area-contour";
import { agentsByLevel } from "../../graph-helper/agents";
import { STATUS_COLORS, surfaceFor } from "./agent-palette";

// A marker sits at the centroid of its area, which for a large feeder can be
// well outside the viewport. Skipping those keeps the DOM to what's visible.
const OFFSCREEN_MARGIN = 40; // px

// Ceiling on markers drawn in one frame. The 9500-bus model has ~1275 secondary
// areas; drawing every one that happens to be on screen would put thousands of
// elements through layout on every pan. Past this many the labels have long
// since stopped being readable anyway, so the cap costs nothing you could use.
const MAX_MARKERS = 120;

/**
 * Pins each distributed agent to the distribution area it operates.
 *
 * Positions are DOM, not WebGL: a marker is a handful of elements, and keeping
 * them as DOM means labels, hover cards and clicks come for free. Centroids are
 * computed once per model in graph space and reprojected on each sigma frame, so
 * panning and zooming is a transform, not a recompute.
 *
 * Clicking a marker drives the shared area highlight, so an agent lights up its
 * own territory through the same contour machinery the area tree uses.
 */
const AgentMarkers = ({ roster, level }) => {
    const sigma = useSigma();
    const { darkMode } = useGraph();
    const areaHighlight = useAreaHighlight();
    const { selection, colors } = areaHighlight;

    // Bumped once per animation frame to reproject the markers.
    const [, setFrame] = useState(0);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!sigma) return;

        // Sigma can emit several renders per frame during a drag. Coalescing to
        // one rAF keeps a hundred markers from re-rendering multiple times per
        // frame, which is what made panning stutter on the larger models.
        const onAfterRender = () => {
            if (frameRef.current) return;
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = 0;
                setFrame((f) => f + 1);
            });
        };

        sigma.on("afterRender", onAfterRender);

        return () => {
            sigma.off("afterRender", onAfterRender);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            frameRef.current = 0;
        };
    }, [sigma]);

    // Centroids are a property of the model, not of the camera, so they are
    // computed once per roster/level and reused for every frame after that.
    const placements = useMemo(() => {
        const agents = agentsByLevel(roster).get(level) ?? [];

        return agents
            .map((agent) => ({
                agent,
                centroid: agent.areaId ? computeAreaCentroid(graphHelper.graph, agent.areaId) : null,
            }))
            // An agent whose area has no nodes in this model can't be placed. It
            // is not dropped — the panel and the bus diagram still list it.
            .filter(({ centroid }) => centroid !== null);
    }, [roster, level]);

    if (!sigma || placements.length === 0) return null;

    const c = surfaceFor(darkMode);
    const { width, height } = sigma.getDimensions();

    const visible = [];
    for (const placement of placements) {
        const { x, y } = sigma.graphToViewport(placement.centroid);
        if (
            x < -OFFSCREEN_MARGIN ||
            y < -OFFSCREEN_MARGIN ||
            x > width + OFFSCREEN_MARGIN ||
            y > height + OFFSCREEN_MARGIN
        ) {
            continue;
        }
        visible.push({ ...placement, x, y });
        if (visible.length >= MAX_MARKERS) break;
    }

    // Portalled into the sigma container rather than rendered in place: this
    // component mounts from a corner ControlsContainer, so an absolutely
    // positioned layer would be measured against that box instead of the canvas
    // the markers have to line up with.
    return createPortal(
        <div
            style={{
                position: "absolute",
                inset: 0,
                // The layer must not eat drags or clicks meant for the graph;
                // each marker opts back in for itself.
                pointerEvents: "none",
                overflow: "hidden",
            }}
        >
            {visible.map(({ agent, x, y }) => {
                const selected = selection.includes(agent.areaId);
                // A selected marker takes its area's contour color, so the chip
                // and the halo it turned on read as the same object.
                const accent = selected ? colors[agent.areaId] : c.border;

                return (
                    <button
                        key={agent.agentId || agent.areaId}
                        type="button"
                        onClick={() => areaHighlight.toggle(agent.areaId)}
                        title={`${agent.agentId}\n${agent.areaName}\n${agent.devices.length} device(s) · ${agent.status}`}
                        style={{
                            position: "absolute",
                            left: x,
                            top: y,
                            transform: "translate(-50%, -50%)",
                            pointerEvents: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            maxWidth: 150,
                            padding: "2px 7px",
                            background: c.panelBg,
                            color: c.text,
                            border: `${selected ? 2 : 1}px solid ${accent}`,
                            borderRadius: 10,
                            fontSize: 11,
                            lineHeight: 1.6,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            boxShadow: darkMode
                                ? "0 1px 4px rgba(0,0,0,0.5)"
                                : "0 1px 4px rgba(0,0,0,0.15)",
                        }}
                    >
                        <span
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                flexShrink: 0,
                                background: STATUS_COLORS[agent.status] ?? STATUS_COLORS.unknown,
                            }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {agent.label || agent.agentId}
                        </span>
                    </button>
                );
            })}
        </div>,
        sigma.getContainer(),
    );
};

export default AgentMarkers;
