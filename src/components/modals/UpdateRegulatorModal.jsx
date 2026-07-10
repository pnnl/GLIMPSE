import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, InputNumber, Button, Divider, Space, Tag, message, Spin, theme } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { v4 as uuidv4 } from "uuid";

// Control modes mirror the legacy gridappsd-viz RegulatorControlMenu.
const CONTROL_MODE = {
    MANUAL: "MANUAL",
    LINE_DROP_COMPENSATION: "LINE_DROP_COMPENSATION",
};

// A regulator edge carries per-phase tap-changer info under a phase key
// (e.g. "AN"/"BN"/"CN"), each of the shape { step, tap } where `tap` is the
// RatioTapChanger mRID for that phase and `step` is its current tap position.
// Pull those phase entries out of the flat attribute bag.
const extractPhaseValues = (attributes) => {
    const phaseValues = {};
    if (!attributes) return phaseValues;
    for (const [key, value] of Object.entries(attributes)) {
        if (value && typeof value === "object" && "tap" in value && "step" in value) {
            phaseValues[key] = {
                mRID: value.tap,
                step: Number.parseInt(value.step, 10) || 0,
                lineDropR: Number.parseFloat(value.lineDropR) || 0,
                lineDropX: Number.parseFloat(value.lineDropX) || 0,
            };
        }
    }
    return phaseValues;
};

const UpdateRegulatorModal = ({ open, close, object }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [controlMode, setControlMode] = useState(CONTROL_MODE.MANUAL);
    const [phaseValues, setPhaseValues] = useState({});
    const [simulationState, setSimulationState] = useState("inactive"); // inactive | idle | running | paused | stopped

    // Sorted phase keys so the form always renders A, B, C in a stable order.
    const phases = useMemo(() => Object.keys(phaseValues).sort((a, b) => a.localeCompare(b)), [phaseValues]);

    // Load the regulator's current per-phase tap positions when the modal opens.
    useEffect(() => {
        if (!open || !object) return;
        try {
            const edge = graphHelper.graph.getEdgeAttributes(object);
            const values = extractPhaseValues(edge.attributes);
            setPhaseValues(values);
            setControlMode(CONTROL_MODE.MANUAL);

            const initial = { controlMode: CONTROL_MODE.MANUAL };
            for (const [phase, v] of Object.entries(values)) {
                initial[`tap_${phase}`] = v.step;
                initial[`lineDropR_${phase}`] = v.lineDropR;
                initial[`lineDropX_${phase}`] = v.lineDropX;
            }
            form.setFieldsValue(initial);
        } catch (error) {
            console.error("Error loading regulator state:", error);
            message.error("Failed to load regulator tap positions");
        }
    }, [open, object, form]);

    useEffect(() => {
        const unsubSimState = socketClientHelper.on("sim-state-change", (simState) => {
            setSimulationState(simState);
        });
        return () => {
            unsubSimState();
        };
    });

    const handleSave = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            if (socketClientHelper.simulationState !== "running") {
                message.error("Simulation is not running. Cannot update tap positions.");
                setLoading(false);
                return;
            }

            const reverseDifferences = [];
            const forwardDifferences = [];
            const localUpdates = {}; // phase -> new step, applied optimistically below

            for (const phase of phases) {
                const current = phaseValues[phase];
                const mRID = current.mRID;

                if (controlMode === CONTROL_MODE.MANUAL) {
                    // Manual mode: push a new tap step per phase (TapChanger.step).
                    const newStep = values[`tap_${phase}`];
                    if (newStep === current.step) continue;

                    reverseDifferences.push({
                        object: mRID,
                        attribute: "TapChanger.step",
                        value: current.step,
                    });
                    forwardDifferences.push({
                        object: mRID,
                        attribute: "TapChanger.step",
                        value: newStep,
                    });
                    localUpdates[phase] = newStep;
                } else {
                    // Line drop compensation mode: enable it and push R/X per phase,
                    // mirroring the legacy RegulatorLineDropUpdateRequest.
                    const newR = values[`lineDropR_${phase}`];
                    const newX = values[`lineDropX_${phase}`];

                    reverseDifferences.push(
                        {
                            object: mRID,
                            attribute: "TapChanger.lineDropCompensation",
                            value: false,
                        },
                        { object: mRID, attribute: "TapChanger.lineDropR", value: current.lineDropR },
                        { object: mRID, attribute: "TapChanger.lineDropX", value: current.lineDropX },
                    );
                    forwardDifferences.push(
                        {
                            object: mRID,
                            attribute: "TapChanger.lineDropCompensation",
                            value: true,
                        },
                        { object: mRID, attribute: "TapChanger.lineDropR", value: newR },
                        { object: mRID, attribute: "TapChanger.lineDropX", value: newX },
                    );
                }
            }

            if (forwardDifferences.length === 0) {
                message.info("No changes to apply.");
                setLoading(false);
                return;
            }

            const inputMessage = {
                command: "update",
                input: {
                    simulation_id: socketClientHelper.simulationID,
                    message: {
                        timestamp: Math.floor(Date.now() / 1000),
                        difference_mrid: uuidv4(),
                        reverse_differences: reverseDifferences,
                        forward_differences: forwardDifferences,
                    },
                },
            };

            console.log(inputMessage);
            socketClientHelper.socket.emit("sim-input", inputMessage);

            // Optimistically reflect new tap steps in the local graph so reopening
            // the modal shows the requested state before the sim echoes it back.
            if (Object.keys(localUpdates).length > 0) {
                graphHelper.graph.updateEdgeAttributes(object, (attrs) => {
                    const nextAttributes = { ...attrs.attributes };
                    for (const [phase, step] of Object.entries(localUpdates)) {
                        nextAttributes[phase] = { ...nextAttributes[phase], step };
                    }
                    return { ...attrs, attributes: nextAttributes };
                });
                graphHelper.sigmaInstance?.refresh();
                setPhaseValues((prev) => {
                    const next = { ...prev };
                    for (const [phase, step] of Object.entries(localUpdates)) {
                        next[phase] = { ...next[phase], step };
                    }
                    return next;
                });
            }

            message.success("Tap update request sent to backend");
            close();
        } catch (error) {
            console.error("Save failed:", error);
            message.error("Failed to send tap update. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        close();
    };

    if (!open || !object) return null;

    const attributes = graphHelper.graph.getEdgeAttributes(object);
    const deviceName = attributes.attributes?.name || attributes.attributes?.mRID || object;
    const hasPhases = phases.length > 0;

    const controlModeOptions = [
        { label: "Manual", value: CONTROL_MODE.MANUAL },
        { label: "Line drop compensation", value: CONTROL_MODE.LINE_DROP_COMPENSATION },
    ];

    return ReactDOM.createPortal(
        <Modal
            centered
            open={open}
            title={`Update Regulator: ${deviceName}`}
            onCancel={handleCancel}
            width={520}
            footer={[
                <Divider key="divider" />,
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="save"
                    disabled={simulationState !== "running" || !hasPhases}
                    type="primary"
                    onClick={handleSave}
                    loading={loading}
                >
                    Apply
                </Button>,
            ]}
        >
            <Spin spinning={loading} description="Updating...">
                <Form form={form} layout="vertical" autoComplete="off">
                    {!hasPhases ? (
                        <p style={{ color: token.colorTextSecondary }}>
                            This device has no tap-changer phases to update.
                        </p>
                    ) : (
                        <>
                            <Form.Item label="Control mode" name="controlMode">
                                <Select
                                    options={controlModeOptions}
                                    onChange={setControlMode}
                                    style={{ width: "100%" }}
                                    // Keep the dropdown inside the themed modal body.
                                    getPopupContainer={(trigger) => trigger.parentElement}
                                />
                            </Form.Item>

                            {controlMode === CONTROL_MODE.MANUAL
                                ? phases.map((phase) => (
                                      <Form.Item
                                          key={phase}
                                          label={`Tap ${phase}`}
                                          name={`tap_${phase}`}
                                          rules={[
                                              { required: true, message: "Tap step is required" },
                                              { type: "number", message: "Tap step must be a number" },
                                          ]}
                                      >
                                          <InputNumber precision={0} style={{ width: "100%" }} />
                                      </Form.Item>
                                  ))
                                : phases.map((phase) => (
                                      <div key={phase} style={{ marginBottom: "12px" }}>
                                          <div
                                              style={{
                                                  marginBottom: "8px",
                                                  fontWeight: 600,
                                                  color: token.colorText,
                                              }}
                                          >
                                              {`Phase ${phase}`}
                                          </div>
                                          <Space size="middle" style={{ display: "flex" }}>
                                              <Form.Item
                                                  label="LineDropR (Ohms)"
                                                  name={`lineDropR_${phase}`}
                                                  style={{ flex: 1 }}
                                                  rules={[
                                                      { required: true, message: "Required" },
                                                      { type: "number", message: "Must be a number" },
                                                  ]}
                                              >
                                                  <InputNumber style={{ width: "100%" }} />
                                              </Form.Item>
                                              <Form.Item
                                                  label="LineDropX (Ohms)"
                                                  name={`lineDropX_${phase}`}
                                                  style={{ flex: 1 }}
                                                  rules={[
                                                      { required: true, message: "Required" },
                                                      { type: "number", message: "Must be a number" },
                                                  ]}
                                              >
                                                  <InputNumber style={{ width: "100%" }} />
                                              </Form.Item>
                                          </Space>
                                      </div>
                                  ))}

                            <div
                                style={{
                                    marginTop: "8px",
                                    padding: "12px",
                                    backgroundColor: token.colorFillTertiary,
                                    borderRadius: token.borderRadiusLG,
                                    fontSize: "12px",
                                    color: token.colorTextSecondary,
                                }}
                            >
                                <p style={{ marginBottom: "8px" }}>
                                    <strong>Current tap positions:</strong>
                                </p>
                                <Space size={[4, 4]} wrap>
                                    {phases.map((phase) => (
                                        <Tag key={phase}>{`${phase}: ${phaseValues[phase].step}`}</Tag>
                                    ))}
                                </Space>
                            </div>
                        </>
                    )}
                </Form>
            </Spin>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default UpdateRegulatorModal;
