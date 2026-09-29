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

const GraphLayout = () => {
    const { darkMode, newGraphUpdate } = useGraph();
    const [activePanel, setActivePanel] = useState(null);
    const [simState, setSimState] = useState("inactive");
    const [logExpanded, setLogExpanded] = useState(true);
    const simActive = simState !== "inactive";
    const chartsActive = simActive && activePanel === "charts";

    // Track the simulation lifecycle so the toolbar/charts/log panels mount and
    // unmount with it.
    useEffect(() => {
        return socketClientHelper.on("sim-state-change", (simulationState) => {
            setSimState(simulationState);
            if (simulationState === "inactive") setActivePanel(null);
        });
    }, []);

    useEffect(() => {
        return socketClientHelper.on("load-graph", () => newGraphUpdate());
    }, [newGraphUpdate]);

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

    const toggleCharts = () => setActivePanel((v) => (v === "charts" ? null : "charts"));

    const border = darkMode ? "#3a3a3a" : "#e0e0e0";

    return (
        <div className="graph-layout">
            <VisToolbar onToggleCharts={toggleCharts} activePanel={activePanel} />
            <Flex direction="row" gap="0" style={{ flex: 1, minHeight: 0, width: "100%" }}>
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

                {simActive && (
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
