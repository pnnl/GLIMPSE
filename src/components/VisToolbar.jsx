import React, { useState, useEffect } from "react";
import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip } from "antd";
import graphHelper from "../graph-helper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";
import { IoPlay, IoAddCircle, IoStop, IoPause, IoSettingsSharp } from "react-icons/io5";
import { MdShowChart } from "react-icons/md";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import SimulationConfigForm from "./forms/SimulationConfigForm";
import StartSimulationModal, { HIDE_START_SIM_WARNING_KEY } from "./modals/StartSimulationModal";
import { useGraph } from "../contexts/GraphContext";

const VisToolbar = ({ onToggleCharts, activePanel }) => {
    const [simulationState, setSimulationState] = useState("inactive"); // inactive | idle | running | paused | stopped
    const [simConfigOpen, setSimConfigOpen] = useState(false);
    const [startWarningOpen, setStartWarningOpen] = useState(false);
    const { darkMode } = useGraph();

    useEffect(() => {
        const unsubSimState = socketClientHelper.on("sim-state-change", (simState) => {
            setSimulationState(simState);
        });

        return () => {
            unsubSimState();
        };
    });

    const rotateCCW = () => {
        graphHelper.rotateCCW();
        graphHelper.sigmaInstance.refresh();
    };

    const rotateCW = () => {
        graphHelper.rotateCW();
        graphHelper.sigmaInstance.refresh();
    };

    const unHighlightCurrent = (obj) => {
        if (obj.type === "edge") {
            graphHelper.graph.setEdgeAttribute(obj.id, "highlighted", false);
        } else {
            graphHelper.graph.setNodeAttribute(obj.id, "highlighted", false);
        }
    };

    const goToPrevious = () => {
        if (graphHelper.highlightedObjects.length === 0) return;

        if (graphHelper.getCurrentHighlightedObject()) {
            unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
        }

        graphHelper.focus(graphHelper.getPrevious());
    };

    const goToNext = () => {
        if (graphHelper.highlightedObjects.length === 0) return;

        if (graphHelper.getCurrentHighlightedObject()) {
            unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
        }

        graphHelper.focus(graphHelper.getNext());
    };

    const handleReset = () => {
        if (graphHelper.getCurrentHighlightedObject()) {
            unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
        }

        graphHelper.reset();
        graphHelper.sigmaInstance.refresh();
    };

    const startSimulation = () => {
        socketClientHelper
            .startSimulation(graphHelper.selectedGridappsdModels)
            .catch((err) => console.error("Failed to start simulation:", err));
    };

    // Warn before running with an untouched (default) configuration, unless
    // the user opted out of the warning.
    const handleStartSimulation = () => {
        const warningDismissed = localStorage.getItem(HIDE_START_SIM_WARNING_KEY) === "true";
        if (!socketClientHelper.simulationConfigCustomized && !warningDismissed) {
            setStartWarningOpen(true);
            return;
        }
        startSimulation();
    };

    const handleStopSimulation = async () => {
        await socketClientHelper.stopSimulation();
    };

    const handlePauseSimulation = () => {
        socketClientHelper.pauseSimulation();
    };

    return (
        <div className="vis-toolbar" style={{ backgroundColor: darkMode ? "#1f1f1f" : "#ffffff" }}>
            <Space
                size={2}
                style={{ marginRight: "auto" }}
                separator={<Divider orientation="vertical" />}
            >
                {simulationState !== "inactive" && (
                    <Space.Compact block>
                        <Tooltip title="Simulation Configuration" placement="bottom">
                            <Button
                                size="medium"
                                icon={<IoSettingsSharp />}
                                disabled={
                                    simulationState === "running" || simulationState === "paused"
                                }
                                onClick={() => setSimConfigOpen(true)}
                            />
                        </Tooltip>
                        {(simulationState === "idle" || simulationState === "stopped") && (
                            <Tooltip title={"Start Simulation"} placement="bottom">
                                <Button
                                    size="medium"
                                    onClick={handleStartSimulation}
                                    icon={<IoPlay />}
                                />
                            </Tooltip>
                        )}
                        {simulationState === "running" && (
                            <Tooltip title={"Pause Simulation"} placement="bottom">
                                <Button
                                    size="medium"
                                    icon={<IoPause />}
                                    onClick={handlePauseSimulation}
                                />
                            </Tooltip>
                        )}
                        <Tooltip title="Stop Simulation">
                            <Button
                                disabled={!(simulationState === "running")}
                                size="medium"
                                onClick={handleStopSimulation}
                                icon={<IoStop />}
                            />
                        </Tooltip>
                    </Space.Compact>
                )}
                {simulationState !== "inactive" && (
                    <Space.Compact block>
                        <Tooltip
                            title={activePanel === "charts" ? "Hide Charts" : "Show Charts"}
                            placement="bottomLeft"
                        >
                            <Button
                                style={{ width: "4rem" }}
                                size="medium"
                                type={activePanel === "charts" ? "primary" : "default"}
                                icon={<MdShowChart />}
                                onClick={onToggleCharts}
                            />
                        </Tooltip>
                    </Space.Compact>
                )}
            </Space>
            <Space
                size={2}
                style={{ marginLeft: "auto" }}
                separator={<Divider orientation="vertical" />}
            >
                <Space.Compact block>
                    <Tooltip title="Rotate Counter-Clockwise">
                        <Button size="medium" onClick={rotateCCW} icon={<BiRotateLeft />} />
                    </Tooltip>
                    <Tooltip title="Rotate Clockwise">
                        <Button size="medium" onClick={rotateCW} icon={<BiRotateRight />} />
                    </Tooltip>
                </Space.Compact>

                <Space.Compact block>
                    <Button
                        size="medium"
                        onClick={goToPrevious}
                        style={{ textTransform: "uppercase" }}
                        type="default"
                    >
                        Prev
                    </Button>
                    <Button
                        size="medium"
                        onClick={goToNext}
                        style={{ textTransform: "uppercase" }}
                        type="default"
                    >
                        Next
                    </Button>
                </Space.Compact>
                <Button
                    size="medium"
                    type="default"
                    style={{ textTransform: "uppercase" }}
                    onClick={handleReset}
                >
                    Reset
                </Button>
            </Space>
            <SimulationConfigForm open={simConfigOpen} onClose={() => setSimConfigOpen(false)} />
            <StartSimulationModal
                open={startWarningOpen}
                onCancel={() => setStartWarningOpen(false)}
                onProceed={() => {
                    setStartWarningOpen(false);
                    startSimulation();
                }}
                onReviewConfig={() => {
                    setStartWarningOpen(false);
                    setSimConfigOpen(true);
                }}
            />
        </div>
    );
};

export default VisToolbar;
