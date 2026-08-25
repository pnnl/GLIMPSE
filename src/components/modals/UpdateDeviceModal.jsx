import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Button, Divider, Spin, theme } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { v4 as uuidv4 } from "uuid";

/**
 * Canonical "OPEN"/"CLOSED" from any of the shapes these attributes hold:
 *   switch `status`      "OPEN" / "CLOSED"   — written by live simulation output
 *   switch `open`        boolean true/false from CIM, or "True"/"False" from a GLM
 *   capacitor `sections` a section count, 0 meaning open
 *
 * @returns {"OPEN"|"CLOSED"|null} null when the attribute is missing or unreadable
 */
const normalizeStatus = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw === "boolean") return raw ? "OPEN" : "CLOSED";

    const text = String(raw).trim().toUpperCase();
    if (text === "OPEN" || text === "CLOSED") return text;
    if (text === "TRUE") return "OPEN";
    if (text === "FALSE") return "CLOSED";

    const count = Number(text);
    return Number.isNaN(count) ? null : count ? "CLOSED" : "OPEN";
};

/** First of `sources` that yields a readable status. */
const readStatus = (attributes, sources) => {
    for (const key of sources) {
        const status = normalizeStatus(attributes[key]);
        if (status) return status;
    }
    return null;
};

const UpdateDeviceModal = ({ open, close, object, deviceType }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [simulationState, setSimulationState] = useState("inactive"); // inactive | idle | running | paused | stopped

    // Configuration for different device types
    const deviceConfig = useMemo(
        () => ({
            capacitor: {
                attribute: "ShuntCompensator.sections",
                statusSources: ["sections"],
                statusOptions: [
                    { label: "OPEN", value: "OPEN" },
                    { label: "CLOSED", value: "CLOSED" },
                ],
                statusValueMap: { OPEN: 0, CLOSED: 1 },
                getAttributes: (id) => graphHelper.graph.getNodeAttributes(id),
            },
            switch: {
                attribute: "Switch.open",
                // `status` is what live simulation output writes onto the edge
                // (see graph-helper/simulation.js). `open` is the model's
                // load-time value and is never updated once a sim is running, so
                // it is only the fallback for the first read.
                statusSources: ["status", "open"],
                statusOptions: [
                    { label: "OPEN", value: "OPEN" },
                    { label: "CLOSED", value: "CLOSED" },
                ],
                statusValueMap: { OPEN: 1, CLOSED: 0 },
                getAttributes: (id) => graphHelper.graph.getEdgeAttributes(id),
            },
        }),
        [],
    );

    const config = useMemo(() => deviceConfig[deviceType], [deviceType, deviceConfig]);

    // Current status, read straight off the graph while the modal is open.
    // Derived (not state): live simulation output writes the device's new state
    // back onto the graph element each tick, so re-reading on every open is what
    // keeps this in step with the running simulation. It also feeds
    // reverse_differences on save, so a stale read here sends a wrong "before"
    // value to the platform.
    const { currentStatus, loadError } = useMemo(() => {
        if (!open || !object || !config) return { currentStatus: null, loadError: null };

        try {
            const attributes = config.getAttributes(object).attributes;
            return { currentStatus: readStatus(attributes, config.statusSources), loadError: null };
        } catch (error) {
            return { currentStatus: null, loadError: error };
        }
    }, [open, object, config]);

    // Sync the antd form (an external store) with the derived status on open.
    useEffect(() => {
        if (!open) return;

        if (loadError) {
            console.error("Error loading device status:", loadError);
            return;
        }
        form.setFieldsValue({ status: currentStatus });
    }, [open, currentStatus, loadError, form]);

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
            console.log(values);

            // Check if simulation is running
            if (socketClientHelper.simulationState !== "running") {
                setLoading(false);
                return;
            }

            // Get device attributes
            const obj = config.getAttributes(object);
            const equipmentMRID = obj.attributes?.mRID ?? object;
            let oldStatus = currentStatus;
            const newStatus = values.status;

            // Map status values
            const oldValue = config.statusValueMap[oldStatus];
            const newValue = config.statusValueMap[newStatus];

            console.log("=====================================");
            console.log("Device MRID:", equipmentMRID);
            console.log("Old Status:", oldStatus, "->", oldValue);
            console.log("New Status:", newStatus, "->", newValue);

            // Build the input message
            const inputMessage = {
                command: "update",
                input: {
                    simulation_id: socketClientHelper.simulationID,
                    message: {
                        timestamp: Math.floor(Date.now() / 1000),
                        difference_mrid: uuidv4(),
                        reverse_differences: [
                            {
                                object: equipmentMRID,
                                attribute: config.attribute,
                                value: oldValue,
                            },
                        ],
                        forward_differences: [
                            {
                                object: equipmentMRID,
                                attribute: config.attribute,
                                value: newValue,
                            },
                        ],
                    },
                },
            };

            // Emit the update to the backend
            console.log(inputMessage);
            socketClientHelper.socket.emit("sim-input", inputMessage);

            close();
        } catch (error) {
            console.error("Save failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        close();
    };

    if (!open || !object || !config) return null;

    const attributes = config.getAttributes(object);
    const deviceName = attributes.attributes?.name ?? object;
    const displayType = deviceType.charAt(0).toUpperCase() + deviceType.slice(1);

    return ReactDOM.createPortal(
        <Modal
            centered
            open={open}
            title={`Update ${displayType}: ${deviceName}`}
            onCancel={handleCancel}
            width={500}
            footer={[
                <Divider key="divider" />,
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="save"
                    disabled={simulationState !== "running"}
                    type="primary"
                    onClick={handleSave}
                    loading={loading}
                >
                    Save
                </Button>,
            ]}
        >
            <Spin spinning={loading} description="Updating...">
                <Form form={form} layout="vertical" autoComplete="off">
                    <Form.Item
                        label="Status"
                        name="status"
                        rules={[{ required: true, message: "Please select a status" }]}
                    >
                        <Select
                            placeholder="Select status"
                            options={config.statusOptions}
                            style={{ width: "100%" }}
                            getPopupContainer={(trigger) => trigger.parentElement}
                        />
                    </Form.Item>
                    <div
                        style={{
                            marginTop: "16px",
                            padding: "12px",
                            backgroundColor: token.colorFillTertiary,
                            borderRadius: token.borderRadiusLG,
                            fontSize: "12px",
                            color: token.colorTextSecondary,
                        }}
                    >
                        <p>
                            <strong>Current Status:</strong> {currentStatus}
                        </p>
                        <p style={{ marginTop: "8px", marginBottom: "0" }}>
                            Device Type: <strong>{attributes.group}</strong>
                        </p>
                    </div>
                </Form>
            </Spin>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default UpdateDeviceModal;
