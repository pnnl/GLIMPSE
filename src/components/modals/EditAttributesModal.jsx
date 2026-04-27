import ReactDOM from "react-dom";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Form, Input, Button, Divider, Typography, message, Spin, Empty } from "antd";
import { LockOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";

const EditAttributesModal = ({ close, context }) => {
    const [form] = Form.useForm();
    const [attributes, setAttributes] = useState({});
    const [loading, setLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { open, object } = context;

    // Read-only attributes that shouldn't be edited
    const READ_ONLY_ATTRIBUTES = useMemo(
        () => ["id", "name", "from", "to", "mRID", "x", "y", "parent"],
        [],
    );

    // Initialize form with current attributes when modal opens
    useEffect(() => {
        if (open && object) {
            let currentAttributes = {};

            try {
                if (object.type === "node") {
                    currentAttributes =
                        graphHelper.graph.getNodeAttribute(object.id, "attributes") || {};
                } else if (object.type === "edge") {
                    currentAttributes =
                        graphHelper.graph.getEdgeAttribute(object.id, "attributes") || {};
                }
            } catch (error) {
                console.error("Error loading attributes:", error);
                message.error("Failed to load attributes");
                return;
            }

            setAttributes(currentAttributes);
            form.setFieldsValue(currentAttributes);
            setHasChanges(false);
        }
    }, [open, object, form]);

    // Track form changes to enable/disable save button
    const handleFormChange = useCallback(() => {
        setHasChanges(true);
    }, []);

    // Determine input type based on value
    const getInputType = useCallback((value) => {
        if (typeof value === "number") return "number";
        if (typeof value === "boolean") return "checkbox";
        return "text";
    }, []);

    const handleSave = async () => {
        if (!hasChanges) {
            message.info("No changes to save");
            close();
            return;
        }

        try {
            setLoading(true);
            const values = await form.validateFields();

            // Update the graph with new attribute values
            if (object.type === "node") {
                graphHelper.graph.setNodeAttribute(object.id, "attributes", values);
                graphHelper.graph.setNodeAttribute(
                    object.id,
                    "attributesLabel",
                    graphHelper.getTitle(values),
                );
            } else if (object.type === "edge") {
                graphHelper.graph.setEdgeAttribute(object.id, "attributes", values);
            }

            graphHelper.sigmaInstance.refresh();
            message.success("Attributes updated successfully");
            close();
        } catch (error) {
            console.error("Save failed:", error);
            message.error("Failed to save attributes. Please check your input.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (hasChanges) {
            Modal.confirm({
                title: "Discard Changes?",
                content: "You have unsaved changes. Are you sure you want to discard them?",
                okText: "Discard",
                cancelText: "Keep Editing",
                onOk() {
                    form.resetFields();
                    close();
                },
            });
        } else {
            form.resetFields();
            close();
        }
    };

    if (!open || !object) return null;

    const attributeEntries = Object.entries(attributes);
    const isEmptyAttributes = attributeEntries.length === 0;

    return ReactDOM.createPortal(
        <Modal
            open={open}
            title={`Edit ${attributes.name ?? "Attributes"}`}
            onCancel={handleCancel}
            styles={{ body: { maxHeight: "60vh", overflowY: "auto" } }}
            width={600}
            footer={[
                <Divider key="divider" />,
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    onClick={handleSave}
                    loading={loading}
                    disabled={!hasChanges}
                >
                    Save Changes
                </Button>,
            ]}
        >
            <Spin spinning={loading} tip="Saving...">
                {isEmptyAttributes ? (
                    <Empty description="No attributes to edit" style={{ marginTop: "32px" }} />
                ) : (
                    <Form
                        form={form}
                        layout="vertical"
                        onValuesChange={handleFormChange}
                        autoComplete="off"
                    >
                        {attributeEntries.map(([attributeName, value], i) => {
                            const isReadOnly = READ_ONLY_ATTRIBUTES.includes(attributeName);

                            return (
                                <Form.Item
                                    label={
                                        <span
                                            style={{
                                                fontWeight: "500",
                                                fontSize: "14px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            {attributeName}
                                            {isReadOnly && (
                                                <LockOutlined
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#999",
                                                    }}
                                                    title="Read-only attribute"
                                                />
                                            )}
                                        </span>
                                    }
                                    name={attributeName}
                                    key={i}
                                    initialValue={value}
                                    tooltip={
                                        isReadOnly
                                            ? "This field is read-only and cannot be edited"
                                            : undefined
                                    }
                                >
                                    {isReadOnly ? (
                                        <Input
                                            value={value}
                                            disabled
                                            style={{
                                                backgroundColor: "#f5f5f5",
                                                cursor: "not-allowed",
                                            }}
                                        />
                                    ) : (
                                        <Input
                                            type={getInputType(value)}
                                            placeholder={`Enter ${attributeName}`}
                                            allowClear
                                        />
                                    )}
                                </Form.Item>
                            );
                        })}
                    </Form>
                )}
            </Spin>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default EditAttributesModal;
