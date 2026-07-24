import "../../styles/GraphLayout.css";
import { useState, useEffect } from "react";
import { Flex } from "antd";
import VisToolbar from "../VisToolbar";
import GraphRenderer from "../graph/GraphRenderer";
import SimulationCharts from "../SimulationCharts";
import SimulationLog from "../SimulationLog";
import CustomSimulationCharts from "../plots/CustomSimulationCharts";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { useGraph } from "../../contexts/GraphContext";

// activePanel: "charts" | null. The legend is no longer a right-hand panel — it
// lives inside the sigma ControlsContainer (see LegendPanel), so it never shares
// this flex row and never resizes the graph.
const GraphLayout = () => {
    const { darkMode, newGraphUpdate } = useGraph();
    const [activePanel, setActivePanel] = useState(null);
    const [simState, setSimState] = useState("inactive");
    // Log panel expand/collapse is owned here (not in SimulationLog) because it
    // changes the graph's height — the resize effect below must re-fit sigma.
    const [logExpanded, setLogExpanded] = useState(true);

    const simActive = simState !== "inactive";

    // Only the charts panel shares the flex row and shrinks the graph (to keep the
    // full topology visible next to live gridappsd charts). With it closed the graph
    // is always full width.
    const chartsActive = activePanel === "charts";

    // Track CIM model status and auto-switch panels when model type changes
    useEffect(() => {
        const unsubSimState = socketClientHelper.on("sim-state-change", (simulationState) => {
            setSimState(simulationState);
        });

        return () => {
            unsubSimState();
        };
    });

    // External scripts can push a graph over the socket "load-graph" event.
    // graphHelper has already rebuilt its graph by the time this fires; we just
    // bump the update trigger so the renderer remounts and shows it.
    useEffect(() => {
        const unsubLoadGraph = socketClientHelper.on("load-graph", () => {
            newGraphUpdate();
        });

        return () => {
            unsubLoadGraph();
        };
    }, [newGraphUpdate]);

    // Re-fit sigma whenever the graph container changes size: the charts panel
    // opening/closing (width), or the sim log panel mounting/expanding (height).
    // sigma.resize(true) forces it to recompute canvas dimensions from the
    // container immediately — without it, sigma waits on its ResizeObserver and
    // the old-height canvas visibly bleeds into the log area until you click.
    // The double rAF lets the flex layout settle before we read the new size.
    // window resize also nudges ECharts (which resizes off window events).
    // Toggling the legend doesn't hit this — it overlays.
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                graphHelper.sigmaInstance?.resize(true);
                graphHelper.sigmaInstance?.refresh();
                window.dispatchEvent(new Event("resize"));
            });
        });
        return () => cancelAnimationFrame(id);
    }, [chartsActive, logExpanded, simActive]);

    // The charts button collapses the panel when it's already active, else opens it.
    const toggleCharts = () => setActivePanel((v) => (v === "charts" ? null : "charts"));

    const border = darkMode ? "#3a3a3a" : "#e0e0e0";

    return (
        <div className="graph-layout">
            <VisToolbar onToggleCharts={toggleCharts} activePanel={activePanel} />
            {/* flex:1 + minHeight:0 lets this row give up vertical space to the
                docked log panel below (which is flex-shrink:0). */}
            <Flex direction="row" gap="0" style={{ flex: 1, minHeight: 0, width: "100%" }}>
                {/* Main graph — always full width unless the charts panel is open.
                    overflow:hidden clips the sigma canvas to this box so it can
                    never paint over the docked log panel during a resize. */}
                <div
                    style={{
                        width: chartsActive ? "70%" : "100%",
                        height: "100%",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <GraphRenderer />
                </div>

                {/* Charts column — shares the flex row so the graph shrinks and the full
                    topology stays visible during a live gridappsd sim. Kept mounted (not
                    unmounted) whenever a sim is active so accumulated chart history isn't
                    wiped when switching panels; it just collapses to zero width. */}
                {simState !== "inactive" && (
                    <div
                        style={{
                            width: chartsActive ? "30%" : "0",
                            height: "100%",
                            position: "relative",
                            overflow: "hidden",
                            borderLeft: chartsActive ? `1px solid ${border}` : "none",
                        }}
                    >
                        {/* Collapsed, the wrapper above is 0-wide but this stays a
                            real 30vw box (clipped by its overflow:hidden). Charts
                            mounted into a 0-width parent make echarts warn at init
                            ("Can't get DOM width or height") and render blank until
                            something resizes them. */}
                        <div
                            style={{
                                visibility: chartsActive ? "visible" : "hidden",
                                display: "flex",
                                flexDirection: "column",
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: chartsActive ? "100%" : "30vw",
                                overflowY: "auto",
                            }}
                        >
                            <SimulationCharts />
                            <CustomSimulationCharts />
                        </div>
                    </div>
                )}
            </Flex>

            {/* Docked below the graph row (only during a sim) so it never
                overlaps the sigma corner controls. Collapsing it leaves just
                the header bar; log history is retained in socketClientHelper. */}
            {simActive && (
                <SimulationLog
                    expanded={logExpanded}
                    onToggleExpanded={() => setLogExpanded((v) => !v)}
                />
            )}
        </div>
    );
};

export default GraphLayout;
