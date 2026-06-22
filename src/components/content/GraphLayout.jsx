import "../../styles/GraphLayout.css";
import { useState, useEffect } from "react";
import { Flex } from "antd";
import VisToolbar from "../VisToolbar";
import GraphRenderer from "../graph/GraphRenderer";
import LegendRenderer from "../legend/LegendRenderer";
import SimulationCharts from "../SimulationCharts";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { useGraph } from "../../contexts/GraphContext";

// activePanel: "charts" | "legend" | null
const GraphLayout = () => {
    const { graphUpdateTrigger, darkMode, newGraphUpdate } = useGraph();
    const [activePanel, setActivePanel] = useState("legend");
    const [simState, setSimState] = useState("inactive");

    const rightPanelVisible = activePanel !== null;

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

    // Let sigma recalculate after the graph container resizes
    useEffect(() => {
        const id = requestAnimationFrame(() => graphHelper.sigmaInstance?.refresh());
        return () => cancelAnimationFrame(id);
    }, [rightPanelVisible]);

    // Clicking the active panel's button collapses the right panel; clicking the
    // other panel's button switches to it.
    const toggleCharts = () => setActivePanel((v) => (v === "charts" ? null : "charts"));
    const toggleLegend = () => setActivePanel((v) => (v === "legend" ? null : "legend"));

    const border = darkMode ? "#3a3a3a" : "#e0e0e0";

    return (
        <div className="graph-layout">
            <VisToolbar
                onToggleLegend={toggleLegend}
                onToggleCharts={toggleCharts}
                activePanel={activePanel}
            />
            <Flex direction="row" gap="0" style={{ height: "inherit", width: "100%" }}>
                {/* Main graph — expands when right panel is hidden */}
                <div style={{ width: rightPanelVisible ? "70%" : "100%", height: "100%" }}>
                    <GraphRenderer />
                </div>

                {/* Right panel */}
                <div
                    style={{
                        display: rightPanelVisible ? "block" : "none",
                        width: "30%",
                        height: "100%",
                        position: "relative",
                        overflow: "hidden",
                        borderLeft: `1px solid ${border}`,
                    }}
                >
                    {simState !== "inactive" && (
                        <div
                            style={{
                                visibility: activePanel === "charts" ? "visible" : "hidden",
                                pointerEvents: activePanel === "charts" ? "auto" : "none",
                                display: "flex",
                                flexDirection: "column",
                                position: "absolute",
                                inset: 0,
                                overflowY: "auto",
                                zIndex: activePanel === "charts" ? 1 : 0,
                            }}
                        >
                            <SimulationCharts />
                        </div>
                    )}

                    {/* Legend */}
                    <div
                        style={{
                            display: activePanel === "legend" ? "block" : "none",
                            position: "absolute",
                            inset: 0,
                        }}
                    >
                        <LegendRenderer />
                    </div>
                </div>
            </Flex>
        </div>
    );
};

export default GraphLayout;
