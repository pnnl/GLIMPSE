import { useEffect, useState } from "react";
import { useSigma } from "@react-sigma/core";
import { buildHoverAttributes } from "../../utils/hover-attributes";
import { hoverBackgroundColor, moreAttributesHint, textColor } from "../../utils/canvas-utils";

const OFFSET = 14;
const CARD_WIDTH = 280;

/**
 * Attribute card for a hovered edge, the counterpart of the node hover card.
 * Sigma v4 has label attachments for nodes only, so this is a DOM overlay.
 */
const EdgeHoverCard = () => {
    const sigma = useSigma();
    const [hover, setHover] = useState(null);

    useEffect(() => {
        const onEnter = ({ edge, event }) => setHover({ edge, x: event.x, y: event.y });
        const onLeave = () => setHover(null);

        sigma.on("enterEdge", onEnter);
        sigma.on("leaveEdge", onLeave);
        sigma.on("downStage", onLeave);
        // Main app opens a context menu on edge right-click; don't leave the card over it.
        sigma.on("downEdge", onLeave);
        return () => {
            sigma.off("enterEdge", onEnter);
            sigma.off("leaveEdge", onLeave);
            sigma.off("downStage", onLeave);
            sigma.off("downEdge", onLeave);
        };
    }, [sigma]);

    const graph = sigma.getGraph();
    if (!hover || !graph.hasEdge(hover.edge)) return null;

    const attrs = graph.getEdgeAttributes(hover.edge);
    const { lines, hidden } = buildHoverAttributes(attrs.attributes);
    // Flip to the cursor's left near the right edge so the card stays on screen.
    const flip = hover.x + OFFSET + CARD_WIDTH > sigma.getContainer().clientWidth;

    return (
        <div
            role="tooltip"
            style={{
                position: "absolute",
                top: hover.y + OFFSET,
                left: flip ? hover.x - OFFSET - CARD_WIDTH : hover.x + OFFSET,
                maxWidth: CARD_WIDTH,
                padding: "6px 10px",
                background: hoverBackgroundColor(),
                color: textColor(),
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                fontSize: 12,
                lineHeight: 1.5,
                pointerEvents: "none",
                zIndex: 10,
            }}
        >
            <div style={{ fontWeight: 600 }}>{attrs.attributes?.name ?? hover.edge}</div>
            {attrs.group && <div>{attrs.group}</div>}
            {lines.map((line) => (
                <div key={line} style={{ color: attrs.color, overflowWrap: "anywhere" }}>
                    {line}
                </div>
            ))}
            {hidden > 0 && moreAttributesHint() && (
                <div style={{ opacity: 0.55 }}>+{hidden} more — see Model Data View</div>
            )}
        </div>
    );
};

export default EdgeHoverCard;
