import ReactDOM from "react-dom";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, Form, Input, Button, Divider, message, Spin, Empty, theme } from "antd";
import { LockOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";

// Read-only attributes that shouldn't be edited
const READ_ONLY_ATTRIBUTES = [
    "secondary_area_name",
    "secondary_area_id",
    "feeder_area_name",
    "switch_area_name",
    "feeder_area_id",
    "switch_area_id",
    "normalSections",
    "GeneratingUnit",
    "normalStatus",
    "dist_areas",
    "class_type",
    "normalOpen",
    "feeder_id",
    "Location",
    "parent",
    "name",
    "from",
    "mRID",
    "AN",
    "BN",
    "CN",
    "id",
    "to",
    "x",
    "y",
];

const EditAttributesModal = ({ close, context }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { open, object } = context;

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

    // Snapshot the object's attributes when the modal opens. Derived during
    // render (not in an effect) so the form renders in a single pass.
    const { attributes, loadError } = useMemo(() => {
        if (!open || !object) return { attributes: {}, loadError: null };

        try {
            if (object.type === "node") {
                return {
                    attributes: graphHelper.graph.getNodeAttribute(object.id, "attributes") || {},
                    loadError: null,
                };
            }
            if (object.type === "edge") {
                return {
                    attributes: graphHelper.graph.getEdgeAttribute(object.id, "attributes") || {},
                    loadError: null,
                };
            }
            return { attributes: {}, loadError: null };
        } catch (error) {
            return { attributes: {}, loadError: error };
        }
    }, [open, object]);

    // Push the snapshot into the antd form (an external store) on open.
    useEffect(() => {
        if (!open || !object) return;

        if (loadError) {
            console.error("Error loading attributes:", loadError);
            message.error("Failed to load attributes");
            return;
        }
        form.setFieldsValue(attributes);
    }, [open, object, attributes, loadError, form]);

    // Track form changes to enable/disable save button
    const handleFormChange = useCallback(() => {
        setHasChanges(true);
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
            setHasChanges(false);
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
                    setHasChanges(false);
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

                            // Read-only fields — and any complex value (arrays/objects
                            // such as per-phase regulator taps like AN/BN/CN, or
                            // dist_areas) — are not registered with the form. A
                            // name-bound Form.Item makes AntD inject the raw store value
                            // into the input, which for an object renders as
                            // "[object Object]"; leaving off `name` lets our explicit
                            // pretty-JSON `value` show instead. Both are preserved
                            // unchanged via the merge on save.
                            if (isReadOnly) {
                                // Render read-only values as full-contrast text in a
                                // bordered box (not a greyed-out disabled input). Uses
                                // AntD theme tokens so it tracks the active light/dark
                                // theme and lines up with the input metrics.
                                const boxStyle = {
                                    minHeight: token.controlHeight,
                                    border: `1px solid ${token.colorBorder}`,
                                    borderRadius: token.borderRadius,
                                    background: token.colorFillTertiary,
                                    color: token.colorText,
                                    padding: `${token.paddingXXS}px ${token.paddingSM}px`,
                                    lineHeight: token.lineHeight,
                                };
                                return (
                                    <Form.Item
                                        label={label}
                                        key={i}
                                        tooltip={
                                            isReadOnly
                                                ? "This field is read-only and cannot be edited"
                                                : undefined
                                        }
                                    >
                                        {isComplexValue(value) ? (
                                            <pre
                                                style={{
                                                    ...boxStyle,
                                                    margin: 0,
                                                    maxHeight: 200,
                                                    overflow: "auto",
                                                    fontFamily: token.fontFamilyCode,
                                                    fontSize: token.fontSizeSM,
                                                }}
                                            >
                                                {formatValue(value)}
                                            </pre>
                                        ) : (
                                            <div
                                                style={{
                                                    ...boxStyle,
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                }}
                                            >
                                                {value === "" || value == null ? "—" : String(value)}
                                            </div>
                                        )}
                                    </Form.Item>
                                );
                            }

                            return (
                                <Form.Item label={label} name={attributeName} key={i}>
                                    <Input value={value} />
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
