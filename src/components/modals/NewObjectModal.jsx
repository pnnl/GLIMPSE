import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Modal, Form, Select, Input, Button, Alert, Space, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";

const NewObjectModal = ({ open, close }) => {
    const [formFields, setFormFields] = useState({
        nodeType: "",
        nodeID: "",
        connectTo: "",
        edgeType: "",
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
            graphHelper.newNodeWithEdge(formFields);
            form.resetFields();
            close();
        } catch (err) {
            setError(err.message || "Failed to create node. Please check your inputs.");
        } finally {
            setLoading(false);
        }
    };

    const handleValuesChange = (changedValue) => {
        setFormFields((prev) => ({ ...prev, ...changedValue }));
    };

    const nodesTypes = useMemo(() => {
        if (graphHelper.graph.order === 0) return [];

        return graphHelper.nodeTypes.map((type) => ({
            label: type,
            value: type,
        }));
    }, []);

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
            disabled={!formFields.nodeType || !formFields.nodeID}
        >
            Create Node
        </Button>,
    ];

    const hasNoGraph = graphHelper.graph.order === 0;

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
            title="Create New Node"
            width={520}
        >
            {hasNoGraph && (
                <Alert
                    title="No nodes in graph"
                    description="Create or load a model first before adding new nodes."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}
            {error && (
                <Alert
                    title="Error"
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
                name="new-node"
                autoComplete="off"
                onValuesChange={handleValuesChange}
            >
                <Space orientation="vertical" size="small" style={{ width: "100%", marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: "#999" }}>Node Definition</span>
                </Space>

                <Form.Item
                    label={
                        <span>
                            Node Type{" "}
                            <Tooltip title="Select the type/class of node to create">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="nodeType"
                    rules={[{ required: true, message: "Please select a node type" }]}
                >
                    <Select
                        placeholder="Choose a node type..."
                        options={nodesTypes}
                        disabled={hasNoGraph}
                    />
                </Form.Item>

                <Form.Item
                    label={
                        <span>
                            Node ID{" "}
                            <Tooltip title="Unique identifier for this node">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="nodeID"
                    rules={[
                        { required: true, message: "Please enter a node ID" },
                        {
                            pattern: /^[a-zA-Z0-9_-]+$/,
                            message: "ID can only contain letters, numbers, hyphens, and underscores",
                        },
                    ]}
                >
                    <Input placeholder="e.g., Node_1 or Node-A" />
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
                            Connect To{" "}
                            <Tooltip title="Select the existing node to connect this new node to">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="connectTo"
                    rules={[{ required: true, message: "Please select a node to connect to" }]}
                >
                    <Select
                        placeholder="Select target node..."
                        options={nodeIDs}
                        disabled={hasNoGraph}
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
                    />
                </Form.Item>

                <Form.Item
                    label={
                        <span>
                            Edge Type{" "}
                            <Tooltip title="Select the type of connection between nodes">
                                <InfoCircleOutlined style={{ marginLeft: 4 }} />
                            </Tooltip>
                        </span>
                    }
                    name="edgeType"
                    rules={[{ required: true, message: "Please select an edge type" }]}
                >
                    <Select
                        placeholder="Choose relationship type..."
                        options={edgeTypes}
                        disabled={hasNoGraph}
                    />
                </Form.Item>
            </Form>
        </Modal>,
        document.getElementById("portal"),
    );
};

export default NewObjectModal;
