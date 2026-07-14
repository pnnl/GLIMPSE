import "../../styles/GraphLayout.css";
import { useState, useEffect } from "react";
import { Flex } from "antd";
import VisToolbar from "../VisToolbar";
import GraphRenderer from "../graph/GraphRenderer";
import SimulationCharts from "../SimulationCharts";
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

    // The graph container only resizes when the charts panel opens/closes. Let
    // sigma re-fit and nudge ECharts (which resizes off window events) after the
    // column width settles. Toggling the legend doesn't hit this — it overlays.
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            graphHelper.sigmaInstance?.refresh();
            window.dispatchEvent(new Event("resize"));
        });
        return () => cancelAnimationFrame(id);
    }, [chartsActive]);

    // The charts button collapses the panel when it's already active, else opens it.
    const toggleCharts = () => setActivePanel((v) => (v === "charts" ? null : "charts"));

    const border = darkMode ? "#3a3a3a" : "#e0e0e0";

    return (
        <div className="graph-layout">
            <VisToolbar onToggleCharts={toggleCharts} activePanel={activePanel} />
            <Flex direction="row" gap="0" style={{ height: "inherit", width: "100%" }}>
                {/* Main graph — always full width unless the charts panel is open. */}
                <div
                    style={{
                        width: chartsActive ? "70%" : "100%",
                        height: "100%",
                        position: "relative",
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
                        <div
                            style={{
                                visibility: chartsActive ? "visible" : "hidden",
                                display: "flex",
                                flexDirection: "column",
                                position: "absolute",
                                inset: 0,
                                overflowY: "auto",
                            }}
                        >
                            <SimulationCharts />
                            <CustomSimulationCharts />
                        </div>
                    </div>
                )}
            </Flex>
        </div>
    );
};

export default GraphLayout;
