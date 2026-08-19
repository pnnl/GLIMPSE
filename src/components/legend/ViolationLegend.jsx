import { useEffect, useState } from "react";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import { useSimLiveTick } from "../../hooks/useSimLiveTick";
import { VIOLATION_LEGEND, isViolation } from "../../utils/electrical";

// Colour scale for violation mode, with a live count beside each band so the
// user can tell whether anything is actually wrong without scanning the canvas.
// Rendered above the type legend in the same sigma ControlsContainer; hidden
// entirely unless violation mode is on.
const ViolationLegend = () => {
    const { darkMode } = useGraph();
    // Re-renders as simulation frames arrive so the counts track the run.
    useSimLiveTick();

    const [enabled, setEnabled] = useState(() => graphHelper.isViolationMode());
    // The band colors below come from a module-level severity scale that
    // GraphRenderer's effect re-points on a light/dark toggle — after this
    // component has already rendered. Bumping on the event re-reads them.
    const [, setThemeTick] = useState(0);

    useEffect(() => {
        const handler = (e) => setEnabled(Boolean(e?.detail?.enabled));
        const bump = () => setThemeTick((n) => n + 1);
        window.addEventListener("graph-violation-mode-change", handler);
        window.addEventListener("graph-theme-changed", bump);
        return () => {
            window.removeEventListener("graph-violation-mode-change", handler);
            window.removeEventListener("graph-theme-changed", bump);
        };
    }, []);

    if (!enabled) return null;

    const counts = graphHelper.getViolationCounts();

    const c = darkMode
        ? { bg: "#1f1f1f", text: "#e0e0e0", sub: "#8c8c8c", border: "#3a3a3a" }
        : { bg: "#ffffff", text: "#1f1f1f", sub: "#8c8c8c", border: "#e0e0e0" };

    return (
        <div
            style={{
                width: 230,
                marginBottom: 8,
                background: c.bg,
                color: c.text,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    padding: "8px 10px",
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: 13,
                    fontWeight: 600,
                }}
            >
                Condition
                <span style={{ float: "right", color: c.sub, fontWeight: 400 }}>
                    {counts.total} {counts.total === 1 ? "issue" : "issues"}
                </span>
            </div>

            <div style={{ padding: "4px 4px 6px" }}>
                {VIOLATION_LEGEND.map(({ severity, hint }) => {
                    const count =
                        (counts.nodes[severity.level] ?? 0) + (counts.edges[severity.level] ?? 0);
                    return (
                        <div
                            key={severity.level}
                            title={hint}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "3px 8px",
                                borderRadius: 4,
                                // Fade out bands that nothing currently falls into.
                                opacity: count === 0 ? 0.45 : 1,
                            }}
                        >
                            <span
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 3,
                                    flexShrink: 0,
                                    background: severity.color,
                                }}
                            />
                            <span
                                style={{
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontWeight: isViolation(severity) && count > 0 ? 600 : 400,
                                }}
                            >
                                {severity.label}
                            </span>
                            <span style={{ color: c.sub, fontVariantNumeric: "tabular-nums" }}>
                                {count}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div
                style={{
                    padding: "6px 10px",
                    borderTop: `1px solid ${c.border}`,
                    fontSize: 10,
                    color: c.sub,
                }}
            >
                Nodes by voltage (ANSI C84.1) · edges by loading
            </div>
        </div>
    );
};

export default ViolationLegend;
