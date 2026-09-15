import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Modal, Form, Select, Input, Button, Alert, Space, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";

const ID_RULE = {
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: "ID can only contain letters, numbers, hyphens, and underscores",
};

const SEARCH_BY_LABEL = {
    filterOption: (input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
};

const toOptions = (types) => types.map((type) => ({ label: type, value: type }));

// The graph is a module singleton (mutations don't re-render these modals), so
// `open` is the recompute signal: options are rebuilt each time a modal opens.
const useGraphOptions = (open) =>
    useMemo(() => {
        if (!open || graphHelper.graph.order === 0) return { nodeTypes: [], nodeIDs: [], edgeTypes: [] };

        return {
            nodeTypes: toOptions(graphHelper.nodeTypes),
            nodeIDs: graphHelper.graph.mapNodes((node, attrs) => ({
                label: attrs.attributes.name ?? node,
                value: node,
            })),
            edgeTypes: toOptions(graphHelper.edgeTypes),
        };
    }, [open]);

const FieldLabel = ({ label, tip }) => (
    <span>
        {label}{" "}
        <Tooltip title={tip}>
            <InfoCircleOutlined style={{ marginLeft: 4 }} />
        </Tooltip>
    </span>
);

const SectionHeading = ({ children, style }) => (
    <Space orientation="vertical" size="small" style={{ width: "100%", marginBottom: 16, ...style }}>
        <span style={{ fontSize: 12, color: "#999" }}>{children}</span>
    </Space>
);

const Notice = ({ title, description }) => (
    <Alert title={title} description={description} type="info" showIcon style={{ marginBottom: 20 }} />
);

// Shared shell: footer, error handling and reset-on-close. `required` lists the
// fields that must be filled before the submit button enables.
const CreateObjectModal = ({ open, close, title, name, submitLabel, required, notice, onCreate, children }) => {
    const [form] = Form.useForm();
    const [error, setError] = useState("");
    const canSubmit = Form.useWatch((values) => required.every((field) => values[field]), form);

    const handleCancel = () => {
        form.resetFields();
        setError("");
        close();
    };

    const handleSubmit = async () => {
        setError("");
        try {
            onCreate(await form.validateFields());
            form.resetFields();
            close();
        } catch (err) {
            setError(err.message || `Failed to ${submitLabel.toLowerCase()}. Please check your inputs.`);
        }
    };

    return createPortal(
        <Modal
            centered
            open={open}
            onCancel={handleCancel}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button key="submit" type="primary" onClick={handleSubmit} disabled={!canSubmit}>
                    {submitLabel}
                </Button>,
            ]}
            title={title}
            width={520}
        >
            {notice}
            {error && (
                <Alert
                    title="Error"
                    description={error}
                    type="error"
                    showIcon
                    closable={{ onClose: () => setError("") }}
                    style={{ marginBottom: 20 }}
                />
            )}
            <Form form={form} layout="vertical" name={name} autoComplete="off">
                {children}
            </Form>
        </Modal>,
        document.getElementById("portal"),
    );
};

export const NewNodeModal = ({ open, close }) => {
    const { nodeTypes, nodeIDs, edgeTypes } = useGraphOptions(open);
    const hasNoGraph = graphHelper.graph.order === 0;

    return (
        <CreateObjectModal
            open={open}
            close={close}
            title="Create New Node"
            name="new-node"
            submitLabel="Create Node"
            required={["nodeType", "nodeID"]}
            notice={
                hasNoGraph && (
                    <Notice
                        title="No nodes in graph"
                        description="Create or load a model first before adding new nodes."
                    />
                )
            }
            onCreate={(values) => graphHelper.newNodeWithEdge(values)}
        >
            <SectionHeading>Node Definition</SectionHeading>

            <Form.Item
                label={<FieldLabel label="Node Type" tip="Select the type/class of node to create" />}
                name="nodeType"
                rules={[{ required: true, message: "Please select a node type" }]}
            >
                <Select placeholder="Choose a node type..." options={nodeTypes} disabled={hasNoGraph} />
            </Form.Item>

            <Form.Item
                label={<FieldLabel label="Node ID" tip="Unique identifier for this node" />}
                name="nodeID"
                rules={[{ required: true, message: "Please enter a node ID" }, ID_RULE]}
            >
                <Input placeholder="e.g., Node_1 or Node-A" />
            </Form.Item>

            <SectionHeading style={{ marginTop: 16 }}>Connection</SectionHeading>

            <Form.Item
                label={
                    <FieldLabel
                        label="Connect To"
                        tip="Select the existing node to connect this new node to"
                    />
                }
                name="connectTo"
                rules={[{ required: true, message: "Please select a node to connect to" }]}
            >
                <Select
                    placeholder="Select target node..."
                    options={nodeIDs}
                    disabled={hasNoGraph}
                    showSearch={SEARCH_BY_LABEL}
                />
            </Form.Item>

            <Form.Item
                label={<FieldLabel label="Edge Type" tip="Select the type of connection between nodes" />}
                name="edgeType"
                rules={[{ required: true, message: "Please select an edge type" }]}
            >
                <Select placeholder="Choose relationship type..." options={edgeTypes} disabled={hasNoGraph} />
            </Form.Item>
        </CreateObjectModal>
    );
};

export const NewEdgeModal = ({ open, close }) => {
    const { nodeIDs, edgeTypes } = useGraphOptions(open);
    const hasNoGraph = graphHelper.graph.order === 0;
    const hasNoNodes = graphHelper.graph.order < 2;

    let notice = null;
    if (hasNoGraph) {
        notice = (
            <Notice title="No nodes in graph" description="Create or load a model first before adding edges." />
        );
    } else if (hasNoNodes) {
        notice = (
            <Notice
                title="Insufficient nodes"
                description="At least 2 nodes are required to create an edge."
            />
        );
    }

    return (
        <CreateObjectModal
            open={open}
            close={close}
            title="Create New Edge"
            name="new-edge"
            submitLabel="Create Edge"
            required={["edgeType", "edgeID", "fromNode", "toNode"]}
            notice={notice}
            onCreate={(values) => graphHelper.newEdge(values)}
        >
            <SectionHeading>Edge Definition</SectionHeading>

            <Form.Item
                label={<FieldLabel label="Edge ID" tip="Unique identifier for this edge" />}
                name="edgeID"
                rules={[{ required: true, message: "Please enter an edge ID" }, ID_RULE]}
            >
                <Input placeholder="e.g., Edge_1 or Connection-A" />
            </Form.Item>

            <Form.Item
                label={<FieldLabel label="Edge Type" tip="Select the type/relationship of this edge" />}
                name="edgeType"
                rules={[{ required: true, message: "Please select an edge type" }]}
            >
                <Select placeholder="Choose edge type..." options={edgeTypes} disabled={hasNoGraph} />
            </Form.Item>

            <SectionHeading style={{ marginTop: 16 }}>Connection</SectionHeading>

            <Form.Item
                label={<FieldLabel label="From Node" tip="Select the source/starting node" />}
                name="fromNode"
                rules={[{ required: true, message: "Please select a source node" }]}
            >
                <Select
                    placeholder="Select source node..."
                    options={nodeIDs}
                    disabled={hasNoNodes}
                    showSearch={SEARCH_BY_LABEL}
                />
            </Form.Item>

            <Form.Item
                label={<FieldLabel label="To Node" tip="Select the destination/target node" />}
                name="toNode"
                rules={[{ required: true, message: "Please select a destination node" }]}
            >
                <Select
                    placeholder="Select destination node..."
                    options={nodeIDs}
                    disabled={hasNoNodes}
                    showSearch={SEARCH_BY_LABEL}
                />
            </Form.Item>
        </CreateObjectModal>
    );
};
