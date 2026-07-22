import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Input, Button, Alert, Space, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";

const NewEdgeModal = ({ open, close }) => {
    const [formFields, setFormFields] = useState({
        edgeID: "",
        edgeType: "",
        fromNode: "",
        toNode: "",
    });
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
        try {
            setError("");
            setLoading(true);
            // Validate required fields
            await form.validateFields();
            graphHelper.newEdge(formFields);
            form.resetFields();
            close();
        } catch (err) {
            setError(err.message || "Failed to create edge. Please check your inputs.");
        } finally {
            setLoading(false);
        }
    };

    const handleValuesChange = (changedValue) => {
        setFormFields((prev) => ({ ...prev, ...changedValue }));
    };

    // The graph is a module singleton (mutations don't re-render this modal),
    // so `open` is the recompute signal: options are rebuilt each time the
    // modal opens and stay stable while it's up.
    const nodeIDs = useMemo(() => {
        // return nothing if there are no nodes in the graph
        if (!open || graphHelper.graph.order === 0) return [];

        return graphHelper.graph.mapNodes((node, attrs) => ({
            label: attrs.attributes.name ?? node,
            value: node,
        }));
    }, [open]);

    const edgeTypes = useMemo(() => {
        if (!open || graphHelper.graph.order === 0) return [];
        return graphHelper.edgeTypes.map((type) => ({
            label: type,
            value: type,
        }));
    }, [open]);

    const footer = [
        <Button
            key="cancel"
            onClick={() => {
                form.resetFields();
                setError("");
                close();
            }}
        >
            Cancel
        </Button>,
        <Button
            key="submit"
            type="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={
                !formFields.edgeType ||
                !formFields.edgeID ||
                !formFields.fromNode ||
                !formFields.toNode
            }
        >
            Create Edge
        </Button>,
    ];

    const hasNoGraph = graphHelper.graph.order === 0;
    const hasNoNodes = graphHelper.graph.order < 2;

    return ReactDOM.createPortal(
        <Modal
            centered
            open={open}
            onCancel={() => {
                form.resetFields();
                setError("");
                close();
            }}
            footer={footer}
            title="Create New Edge"
            width={520}
        >
            {hasNoGraph && (
                <Alert
                    title="No nodes in graph"
                    description="Create or load a model first before adding edges."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}
            {!hasNoGraph && hasNoNodes && (
                <Alert
                    message="Insufficient nodes"
                    description="At least 2 nodes are required to create an edge."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}
            {error && (
                <Alert
                    message="Error"
                    description={error}
                    type="error"
                    showIcon
                    closable
                    onClose={() => setError("")}
                    style={{ marginBottom: 20 }}
                />
            )}
            <Form
                form={form}
                layout="vertical"
                name="new-edge"
                autoComplete="off"
                onValuesChange={handleValuesChange}
            >
                <Space
                    orientation="vertical"
                    size="small"
                    style={{ width: "100%", marginBottom: 16 }}
                >
                    <span style={{ fontSize: 12, color: "#999" }}>Edge Definition</span>
                </Space>

                <Form.Item
                    label={
                        <span>
                            Edge ID{" "}
                            <Tooltip title="Unique identifier for this edge">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="edgeID"
                    rules={[
                        { required: true, message: "Please enter an edge ID" },
                        {
                            pattern: /^[a-zA-Z0-9_-]+$/,
                            message:
                                "ID can only contain letters, numbers, hyphens, and underscores",
                        },
                    ]}
                >
                    <Input placeholder="e.g., Edge_1 or Connection-A" />
                </Form.Item>

                <Form.Item
                    label={
                        <span>
                            Edge Type{" "}
                            <Tooltip title="Select the type/relationship of this edge">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="edgeType"
                    rules={[{ required: true, message: "Please select an edge type" }]}
                >
                    <Select
                        placeholder="Choose edge type..."
                        options={edgeTypes}
                        disabled={hasNoGraph}
                    />
                </Form.Item>

                <Space
                    orientation="vertical"
                    size="small"
                    style={{ width: "100%", marginBottom: 16, marginTop: 16 }}
                >
                    <span style={{ fontSize: 12, color: "#999" }}>Connection</span>
                </Space>

                <Form.Item
                    label={
                        <span>
                            From Node{" "}
                            <Tooltip title="Select the source/starting node">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="fromNode"
                    rules={[{ required: true, message: "Please select a source node" }]}
                >
                    <Select
                        placeholder="Select source node..."
                        options={nodeIDs}
                        disabled={hasNoNodes}
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </Form.Item>

                <Form.Item
                    label={
                        <span>
                            To Node{" "}
                            <Tooltip title="Select the destination/target node">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="toNode"
                    rules={[{ required: true, message: "Please select a destination node" }]}
                >
                    <Select
                        placeholder="Select destination node..."
                        options={nodeIDs}
                        disabled={hasNoNodes}
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </Form.Item>
            </Form>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default NewEdgeModal;
