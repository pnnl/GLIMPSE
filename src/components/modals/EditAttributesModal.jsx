import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Divider, Typography } from "antd";
import graphHelper from "../../graph-helper/GraphHelper";

const EditAttributesModal = ({ close, context }) => {
    const [form] = Form.useForm();
    const [attributes, setAttributes] = useState({});
    const { open, object } = context;

    // Initialize form with current attributes when modal opens
    useEffect(() => {
        if (open && object) {
            let currentAttributes = {};

            if (object.type === "node") {
                currentAttributes = graphHelper.graph.getNodeAttribute(object.id, "attributes");
            } else if (object.type === "edge") {
                currentAttributes = graphHelper.graph.getEdgeAttribute(object.id, "attributes");
            }

            setAttributes(currentAttributes);
            form.setFieldsValue(currentAttributes);
        }
    }, [open, object, form]);

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            console.log(values);

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
            close();
        } catch (error) {
            console.error("Validation failed:", error);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        close();
    };

    if (!open || !object) return null;

    const readOnlyAttributes = ["id", "name", "from", "to", "mRID", "x", "y"];

    return ReactDOM.createPortal(
        <Modal
            open={open}
            title={`Edit ${object.name || ""} Attributes`}
            onCancel={handleCancel}
            styles={{ body: { maxHeight: "60vh", overflowY: "auto" } }}
            footer={[
                <Divider key="divider" />,
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button key="save" type="primary" onClick={handleSave}>
                    Save
                </Button>,
            ]}
        >
            <Form form={form} layout="vertical">
                {Object.entries(attributes).map(([attributeName, value], i) => (
                    <Form.Item
                        label={
                            <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                                {attributeName}
                            </span>
                        }
                        name={attributeName}
                        key={i}
                        initialValue={value}
                    >
                        {readOnlyAttributes.includes(attributeName) ? (
                            <Typography.Text>{value}</Typography.Text>
                        ) : (
                            <Input placeholder={`Enter ${attributeName}`} />
                        )}
                    </Form.Item>
                ))}
            </Form>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default EditAttributesModal;
