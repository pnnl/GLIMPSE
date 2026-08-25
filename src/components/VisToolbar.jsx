import React, { useState, useEffect } from "react";
import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip } from "antd";
import graphHelper from "../graph-helper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";
import { IoPlay, IoAddCircle, IoStop, IoPause, IoSettingsSharp, IoWarning } from "react-icons/io5";
import { MdShowChart } from "react-icons/md";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import SimulationConfigForm from "./forms/SimulationConfigForm";
import StartSimulationModal, { HIDE_START_SIM_WARNING_KEY } from "./modals/StartSimulationModal";
import { useGraph } from "../contexts/GraphContext";
import { useShortcut } from "../hooks/useShortcut";
import { reportError } from "../utils/notify";

const VisToolbar = ({ onToggleCharts, activePanel }) => {
    const [simulationState, setSimulationState] = useState("inactive"); // inactive | idle | running | paused | stopped
    const [simConfigOpen, setSimConfigOpen] = useState(false);
    const [startWarningOpen, setStartWarningOpen] = useState(false);
    const [violationMode, setViolationMode] = useState(() => graphHelper.isViolationMode());
    const { darkMode } = useGraph();

    // Condition coloring only says anything once measurements are flowing.
    const canShowViolations = simulationState === "running" || simulationState === "paused";

    // graphHelper owns the flag (the reducers read it directly); mirror it here
    // so the button reflects changes made via the shortcut too.
    useEffect(() => {
        const handler = (e) => setViolationMode(Boolean(e?.detail?.enabled));
        window.addEventListener("graph-violation-mode-change", handler);
        return () => window.removeEventListener("graph-violation-mode-change", handler);
    }, []);

    // Empty deps: the subscription is stable for the lifetime of the component.
    // Without them this tore down and re-registered the listener on every
    // render — i.e. on every simulation frame.
    useEffect(() => {
        const unsubSimState = socketClientHelper.on("sim-state-change", (simState) => {
            setSimulationState(simState);
        });

        return () => {
            unsubSimState();
        };
    }, []);

    // Optional chaining throughout: these are reachable by keyboard shortcut,
    // so they can fire before a model (and therefore a sigma instance) exists.
    const rotateCCW = () => {
        graphHelper.rotateCCW();
        graphHelper.sigmaInstance?.refresh();
    };

    const rotateCW = () => {
        graphHelper.rotateCW();
        graphHelper.sigmaInstance?.refresh();
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
        if (graphHelper.graph.order === 0) return;

        if (graphHelper.getCurrentHighlightedObject()) {
            unHighlightCurrent(graphHelper.getCurrentHighlightedObject());
        }

        graphHelper.reset();
        graphHelper.sigmaInstance?.refresh();
    };

    const startSimulation = () => {
        socketClientHelper
            .startSimulation(graphHelper.selectedGridappsdModels)
            .catch((err) => reportError("Could not start the simulation", err));
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
        try {
            await socketClientHelper.stopSimulation();
        } catch (err) {
            reportError("Could not stop the simulation", err);
        }
    };

    const handlePauseSimulation = () => {
        socketClientHelper
            .pauseSimulation()
            .catch((err) => reportError("Could not pause the simulation", err));
    };

    useShortcut("n", goToNext);
    useShortcut("p", goToPrevious);
    useShortcut("r", handleReset);
    useShortcut("v", () => graphHelper.toggleViolationMode(), { enabled: canShowViolations });

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
                                aria-label="Simulation configuration"
                                icon={<IoSettingsSharp />}
                                disabled={simulationState === "running" || simulationState === "paused"}
                                onClick={() => setSimConfigOpen(true)}
                            />
                        </Tooltip>
                        {(simulationState === "idle" || simulationState === "stopped") && (
                            <Tooltip title={"Start Simulation"} placement="bottom">
                                <Button
                                    size="medium"
                                    aria-label="Start simulation"
                                    onClick={handleStartSimulation}
                                    icon={<IoPlay />}
                                />
                            </Tooltip>
                        )}
                        {simulationState === "running" && (
                            <Tooltip title={"Pause Simulation"} placement="bottom">
                                <Button
                                    size="medium"
                                    aria-label="Pause simulation"
                                    icon={<IoPause />}
                                    onClick={handlePauseSimulation}
                                />
                            </Tooltip>
                        )}
                        <Tooltip title="Stop Simulation">
                            <Button
                                disabled={!(simulationState === "running")}
                                size="medium"
                                aria-label="Stop simulation"
                                onClick={handleStopSimulation}
                                icon={<IoStop />}
                            />
                        </Tooltip>
                    </Space.Compact>
                )}
                {simulationState !== "inactive" && (
                    <Space.Compact block>
                        <Tooltip
                            title={
                                !canShowViolations
                                    ? "Condition coloring needs a running simulation"
                                    : violationMode
                                      ? "Show object types (V)"
                                      : "Color by voltage & loading violations (V)"
                            }
                            placement="bottom"
                        >
                            <Button
                                style={{ width: "4rem" }}
                                size="medium"
                                aria-label="Toggle violation coloring"
                                aria-pressed={violationMode}
                                disabled={!canShowViolations}
                                type={violationMode ? "primary" : "default"}
                                icon={<IoWarning />}
                                onClick={() => graphHelper.toggleViolationMode()}
                            />
                        </Tooltip>
                        <Tooltip
                            title={activePanel === "charts" ? "Hide Charts" : "Show Charts"}
                            placement="bottomLeft"
                        >
                            <Button
                                style={{ width: "4rem" }}
                                size="medium"
                                aria-label={activePanel === "charts" ? "Hide charts" : "Show charts"}
                                aria-pressed={activePanel === "charts"}
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
                        <Button
                            size="medium"
                            aria-label="Rotate counter-clockwise"
                            onClick={rotateCCW}
                            icon={<BiRotateLeft />}
                        />
                    </Tooltip>
                    <Tooltip title="Rotate Clockwise">
                        <Button
                            size="medium"
                            aria-label="Rotate clockwise"
                            onClick={rotateCW}
                            icon={<BiRotateRight />}
                        />
                    </Tooltip>
                </Space.Compact>

                <Space.Compact block>
                    <Tooltip title="Previous highlighted object (P)">
                        <Button
                            size="medium"
                            onClick={goToPrevious}
                            style={{ textTransform: "uppercase" }}
                            type="default"
                        >
                            Prev
                        </Button>
                    </Tooltip>
                    <Tooltip title="Next highlighted object (N)">
                        <Button
                            size="medium"
                            onClick={goToNext}
                            style={{ textTransform: "uppercase" }}
                            type="default"
                        >
                            Next
                        </Button>
                    </Tooltip>
                </Space.Compact>
                <Tooltip title="Clear highlighting and show all objects (R)">
                    <Button
                        size="medium"
                        type="default"
                        style={{ textTransform: "uppercase" }}
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                </Tooltip>
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
