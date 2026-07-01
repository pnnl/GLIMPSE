import ReactDOM from "react-dom";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Form, Input, Button, Divider, message, Spin, Empty } from "antd";
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
        () => [
            "id",
            "name",
            "from",
            "to",
            "mRID",
            "x",
            "y",
            "parent",
            "dist_areas",
            "feeder_area_id",
            "feeder_area_name",
            "switch_area_id",
            "switch_area_name",
            "secondary_area_id",
            "secondary_area_name",
            "class_type",
            "feeder_id",
            "Location",
            "normalOpen",
            "normalStatus",
            "normalSections",
            "GeneratingUnit",
        ],
        [],
    );

    // Arrays/objects (e.g. dist_areas) can't render in a plain Input; show them
    // as pretty JSON in a read-only textarea instead.
    const isComplexValue = useCallback(
        (value) => Array.isArray(value) || (value !== null && typeof value === "object"),
        [],
    );
    const formatValue = useCallback(
        (value) => (isComplexValue(value) ? JSON.stringify(value, null, 2) : value),
        [isComplexValue],
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

            // Only editable fields are registered in the form; merge them over
            // the originals so read-only values (including complex ones like
            // dist_areas) are preserved unchanged.
            const merged = { ...attributes, ...values };

            // Update the graph with new attribute values
            if (object.type === "node") {
                graphHelper.graph.setNodeAttribute(object.id, "attributes", merged);
                graphHelper.graph.setNodeAttribute(
                    object.id,
                    "attributesLabel",
                    graphHelper.getTitle(merged),
                );
            } else if (object.type === "edge") {
                graphHelper.graph.setEdgeAttribute(object.id, "attributes", merged);
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
            <Spin spinning={loading} description="Saving...">
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
                            const label = (
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
                                            style={{ fontSize: "12px", color: "#999" }}
                                            title="Read-only attribute"
                                        />
                                    )}
                                </span>
                            );

                            // Read-only fields are not registered with the form (they're
                            // preserved via the merge on save), so AntD's disabled styling
                            // applies and follows the active light/dark theme.
                            if (isReadOnly) {
                                return (
                                    <Form.Item
                                        label={label}
                                        key={i}
                                        tooltip="This field is read-only and cannot be edited"
                                    >
                                        {isComplexValue(value) ? (
                                            <Input.TextArea
                                                value={formatValue(value)}
                                                disabled
                                                autoSize={{ minRows: 1, maxRows: 8 }}
                                                style={{ cursor: "not-allowed" }}
                                            />
                                        ) : (
                                            <Input
                                                value={value}
                                                disabled
                                                style={{ cursor: "not-allowed" }}
                                            />
                                        )}
                                    </Form.Item>
                                );
                            }

                            return (
                                <Form.Item
                                    label={label}
                                    name={attributeName}
                                    key={i}
                                    initialValue={value}
                                >
                                    <Input
                                        type={getInputType(value)}
                                        placeholder={`Enter ${attributeName}`}
                                        allowClear
                                    />
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
