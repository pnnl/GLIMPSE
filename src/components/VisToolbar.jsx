import React, { useState, useEffect } from "react";
import "../styles/VisToolbar.css";
import { Button, Divider, Space, Tooltip } from "antd";
import graphHelper from "../graph-helper/GraphHelper";
import { BiRotateLeft, BiRotateRight } from "react-icons/bi";
import { IoPlay, IoAddCircle, IoStop, IoPause } from "react-icons/io5";
import { MdOutlineHideSource } from "react-icons/md";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";

const VisToolbar = ({ onToggleLegend }) => {
    const [changingSimState, setChangingSimState] = useState(false);
    const [simulationState, setSimulationState] = useState("idle"); // idle | running | paused | stopped

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

    const handleStartSimulation = () => {
        socketClientHelper.startSimulation(graphHelper.selectedGridappsdModels);
    };

    const handleStopSimulation = async () => {
        setChangingSimState(true);
        await socketClientHelper.stopSimulation();
        setChangingSimState(false);
    };

    const handlePauseSimulation = () => {
        socketClientHelper.pauseSimulation();
    };

    return (
        <div className="vis-toolbar">
            <Space
                size={2}
                style={{ marginRight: "auto" }}
                separator={<Divider orientation="vertical" />}
            >
                <Tooltip title={"Start Simulation"} placement="bottomLeft">
                    <Button
                        loading={changingSimState}
                        style={{ width: "4rem" }}
                        size="large"
                        type="default"
                        icon={<IoPlay />}
                        onClick={handleStartSimulation}
                    />
                </Tooltip>
                <Space.Compact block>
                    <Tooltip title={"Start Simulation"}>
                        {simulationState === "idle" ||
                            (simulationState === "stopped" && (
                                <Button
                                    size="large"
                                    onClick={handleStartSimulation}
                                    icon={<IoPlay />}
                                />
                            ))}
                        {simulationState === "running" && (
                            <Button
                                size="large"
                                icon={<IoPause />}
                                onClick={handlePauseSimulation}
                            />
                        )}
                    </Tooltip>
                    <Tooltip title="Stop Simulation">
                        <Button
                            disabled={!(simulationState === "running")}
                            size="large"
                            onClick={handleStopSimulation}
                            icon={<IoStop />}
                        />
                    </Tooltip>
                </Space.Compact>
                <Tooltip title="Add Overlay" placement="bottomLeft">
                    <Button
                        disabled
                        style={{ width: "4rem" }}
                        size="large"
                        type="default"
                        icon={<IoAddCircle size={24} />}
                    />
                </Tooltip>
                <Tooltip title="Hide/Show Legend" placement="bottomLeft">
                    <Button
                        style={{ width: "4rem" }}
                        size="large"
                        type="default"
                        icon={<MdOutlineHideSource />}
                        onClick={onToggleLegend}
                    />
                </Tooltip>
            </Space>
            <Space
                size={2}
                style={{ marginLeft: "auto" }}
                separator={<Divider orientation="vertical" />}
            >
                <Space.Compact block>
                    <Tooltip title="Rotate Counter-Clockwise">
                        <Button size="large" onClick={rotateCCW} icon={<BiRotateLeft />} />
                    </Tooltip>
                    <Tooltip title="Rotate Clockwise">
                        <Button size="large" onClick={rotateCW} icon={<BiRotateRight />} />
                    </Tooltip>
                </Space.Compact>

                <Space.Compact block>
                    <Button
                        size="large"
                        onClick={goToPrevious}
                        style={{ textTransform: "uppercase" }}
                        type="default"
                    >
                        Prev
                    </Button>
                    <Button
                        size="large"
                        onClick={goToNext}
                        style={{ textTransform: "uppercase" }}
                        type="default"
                    >
                        Next
                    </Button>
                </Space.Compact>
                <Button
                    size="large"
                    type="default"
                    style={{ textTransform: "uppercase" }}
                    onClick={handleReset}
                >
                    Reset
                </Button>
            </Space>
        </div>
    );
};

export default VisToolbar;
