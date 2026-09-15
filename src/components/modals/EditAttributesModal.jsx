import ReactDOM from "react-dom";
import { useState, useEffect, useMemo } from "react";
import { Modal, Form, Input, Button, Divider, Spin, Empty, theme } from "antd";
import { LockOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";
import { notify } from "../../utils/notify";

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

// Arrays/objects (e.g. dist_areas) can't render in a plain Input.
const isComplexValue = (value) => value !== null && typeof value === "object";

const EditAttributesModal = ({ close, context }) => {
    const [form] = Form.useForm();
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const { open, object } = context;

    // Snapshot the object's attributes when the modal opens. Derived during
    // render (not in an effect) so the form renders in a single pass.
    const { attributes, loadError } = useMemo(() => {
        if (!open || !object) return { attributes: {}, loadError: null };

        try {
            let attributes = {};
            if (object.type === "node") {
                attributes = graphHelper.graph.getNodeAttribute(object.id, "attributes") || {};
            } else if (object.type === "edge") {
                attributes = graphHelper.graph.getEdgeAttribute(object.id, "attributes") || {};
            }
            return { attributes, loadError: null };
        } catch (error) {
            return { attributes: {}, loadError: error };
        }
    }, [open, object]);

    // Push the snapshot into the antd form (an external store) on open.
    useEffect(() => {
        if (!open || !object) return;

        if (loadError) {
            console.error("Error loading attributes:", loadError);
            notify.error("Failed to load attributes");
            return;
        }
        form.setFieldsValue(attributes);
    }, [open, object, attributes, loadError, form]);

    const handleSave = async () => {
        if (!hasChanges) {
            notify.info("No changes to save");
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

            if (object.type === "node") {
                graphHelper.graph.setNodeAttribute(object.id, "attributes", merged);
                // Rebuild the hover card so it reflects the edited attributes
                // (and keeps any live vitals block).
                graphHelper.refreshNodeHover(object.id);
            } else if (object.type === "edge") {
                graphHelper.graph.setEdgeAttribute(object.id, "attributes", merged);
            }

            graphHelper.markDirty();
            graphHelper.sigmaInstance?.refresh();
            notify.success("Attributes updated successfully");
            setHasChanges(false);
            close();
        } catch (error) {
            console.error("Save failed:", error);
            notify.error("Failed to save attributes. Please check your input.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (hasChanges) {
            notify.confirm({
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
                        onValuesChange={() => setHasChanges(true)}
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

                            // Read-only fields are not registered with the form (a
                            // name-bound Form.Item would render objects as
                            // "[object Object]"); the merge on save preserves them.
                            // Shown as full-contrast text in a token-styled box.
                            if (isReadOnly) {
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
                                        tooltip="This field is read-only and cannot be edited"
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
                                                {JSON.stringify(value, null, 2)}
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
