import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Button, Divider, message, Spin, theme } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { v4 as uuidv4 } from "uuid";

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
                statusSource: "sections",
                statusOptions: [
                    { label: "OPEN", value: "OPEN" },
                    { label: "CLOSED", value: "CLOSED" },
                ],
                statusValueMap: { OPEN: 0, CLOSED: 1 },
                getAttributes: (id) => graphHelper.graph.getNodeAttributes(id),
            },
            switch: {
                attribute: "Switch.open",
                statusSource: "open",
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
    // Derived (not state): the modal closes right after a save, and the save
    // path updates the graph optimistically, so the next open re-reads the
    // fresh value here.
    const { currentStatus, loadError } = useMemo(() => {
        if (!open || !object || !config) return { currentStatus: null, loadError: null };

        try {
            const status = config.getAttributes(object).attributes[config.statusSource];

            // Normalize whatever the source attribute holds ("True"/"False" for
            // switches, a numeric section count for capacitors) into the canonical
            // "OPEN"/"CLOSED" label the form and statusValueMap are keyed by.
            let normalizedStatus;
            if (status !== "False" && status !== "True") {
                normalizedStatus = parseInt(status, 10) ? "CLOSED" : "OPEN"; // Handle capacitor status mapping
            } else {
                normalizedStatus = status === "False" ? "CLOSED" : "OPEN";
            }
            return { currentStatus: normalizedStatus, loadError: null };
        } catch (error) {
            return { currentStatus: null, loadError: error };
        }
    }, [open, object, config]);

    // Sync the antd form (an external store) with the derived status on open.
    useEffect(() => {
        if (!open) return;

        if (loadError) {
            console.error("Error loading device status:", loadError);
            message.error("Failed to load device status");
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
                message.error("Simulation is not running. Cannot update status.");
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

            message.success(`Status update request sent to backend`);
            close();
        } catch (error) {
            console.error("Save failed:", error);
            message.error("Failed to send status update. Please try again.");
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
                            // Render the dropdown inside the (themed) modal body so it
                            // follows the active light/dark theme instead of the
                            // document-body default.
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
