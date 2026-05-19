import React, { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Button, Divider, message, Spin } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { v4 as uuidv4 } from "uuid";

const UpdateDeviceModal = ({ open, close, object, deviceType }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(null);
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

    // Initialize form with current status when modal opens
    useEffect(() => {
        if (open && object && config) {
            try {
                const edge = config.getAttributes(object);
                console.log(edge);
                const status = edge.attributes[config.statusSource];

                if (status !== "False" && status !== "True") {
                    const capStatus = parseInt(status, 10) ? "CLOSED" : "OPEN"; // Handle capacitor status mapping
                    setCurrentStatus(capStatus);
                    form.setFieldsValue({ status: capStatus });
                } else {
                    setCurrentStatus(status);
                    form.setFieldsValue({ status: status === "False" ? "CLOSED" : "OPEN" });
                }
            } catch (error) {
                console.error("Error loading device status:", error);
                message.error("Failed to load device status");
            }
        }
    }, [open, object, deviceType, config, form]);

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
                        />
                    </Form.Item>
                    <div
                        style={{
                            marginTop: "16px",
                            padding: "12px",
                            backgroundColor: "#f5f5f5",
                            borderRadius: "4px",
                            fontSize: "12px",
                            color: "#666",
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
