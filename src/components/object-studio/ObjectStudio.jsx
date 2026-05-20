import React, { useState, useMemo, useCallback } from "react";
import { Splitter, Tabs, Button, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import ObjectTypesPane from "./ObjectTypesPane";
import ObjectTable from "./ObjectTable";
import EditObject from "./EditObject";
import "./ObjectStudio.css";

/**
 * Resolves the feeder ID for a given mRID by checking the graph first,
 * then falling back to the provided feederId.
 * This ensures multi-feeder correctness.
 */
const resolveFeederIdFromGraph = (mRID, fallbackFeederId) => {
    const graph = graphHelper.graph;

    // Check nodes first
    if (graph.hasNode(mRID)) {
        const attrs = graph.getNodeAttributes(mRID);
        if (attrs?.attributes?.feeder_id) {
            return attrs.attributes.feeder_id;
        }
    }

    // Check edges
    if (graph.hasEdge(mRID)) {
        const attrs = graph.getEdgeAttributes(mRID);
        if (attrs?.attributes?.feeder_id) {
            return attrs.attributes.feeder_id;
        }
    }

    // Fallback: use provided or global
    return fallbackFeederId || graphHelper.currentFeederID || null;
};

const ObjectStudio = () => {
    const { graphUpdateTrigger, setView } = useGraph();
    const [activeTab, setActiveTab] = useState("edges");
    const [filterTypes, setFilterTypes] = useState(null);

    // Navigation state: current object + history stack
    const [objectToEdit, setObjectToEdit] = useState(null);
    const [navigationHistory, setNavigationHistory] = useState([]);

    // Derive graph data
    const { nodes, edges, nodeColumns, edgeColumns, nodeTypes, edgeTypes } = useMemo(() => {
        const graph = graphHelper.graph;
        const nodeColSet = new Set(["type"]);
        const edgeColSet = new Set(["type"]);
        const nTypes = new Set();
        const eTypes = new Set();
        const nodeList = [];
        const edgeList = [];

        graph.forEachNode((id, attrs) => {
            nTypes.add(attrs.group);
            if (attrs.attributes) {
                Object.keys(attrs.attributes).forEach((k) => nodeColSet.add(k));
            }
            nodeList.push({ id, ...attrs });
        });

        graph.forEachEdge((id, attrs, source, target) => {
            eTypes.add(attrs.group);
            if (attrs.attributes) {
                Object.keys(attrs.attributes).forEach((k) => edgeColSet.add(k));
            }
            edgeList.push({ id, source, target, ...attrs });
        });

        return {
            nodes: nodeList,
            edges: edgeList,
            nodeColumns: Array.from(nodeColSet),
            edgeColumns: Array.from(edgeColSet),
            nodeTypes: Array.from(nTypes).sort(),
            edgeTypes: Array.from(eTypes).sort(),
        };
    }, [graphUpdateTrigger]);

    const filteredNodes = useMemo(() => {
        if (!filterTypes || !filterTypes.nodes) return nodes;
        return nodes.filter((n) => filterTypes.nodes.includes(n.group));
    }, [nodes, filterTypes]);

    const filteredEdges = useMemo(() => {
        if (!filterTypes || !filterTypes.edges) return edges;
        return edges.filter((e) => filterTypes.edges.includes(e.group));
    }, [edges, filterTypes]);

    /**
     * Central navigation handler — called from ObjectTable or EditObject.
     * Normalizes the object descriptor with a guaranteed feederId for CIM.
     */
    const navigateToObject = useCallback(
        (objectDescriptor, { pushHistory = true } = {}) => {
            if (graphHelper.isCIM) {
                const { mRID, feederId: providedFeederId } = objectDescriptor;

                // Always resolve feeder ID from the graph as the source of truth
                const resolvedFeederId = resolveFeederIdFromGraph(mRID, providedFeederId);

                const normalizedObject = {
                    mRID,
                    feederId: resolvedFeederId,
                };

                // Push current object to history before navigating
                if (pushHistory && objectToEdit) {
                    setNavigationHistory((prev) => [...prev, objectToEdit]);
                }

                setObjectToEdit(normalizedObject);
            } else {
                // Non-CIM: find in graph
                let normalizedObject = null;

                if (graphHelper.graph.hasNode(objectDescriptor.id || objectDescriptor.mRID)) {
                    normalizedObject = {
                        type: "node",
                        id: objectDescriptor.id || objectDescriptor.mRID,
                    };
                } else if (graphHelper.graph.hasEdge(objectDescriptor.id || objectDescriptor.mRID)) {
                    normalizedObject = {
                        type: "edge",
                        id: objectDescriptor.id || objectDescriptor.mRID,
                    };
                } else if (objectDescriptor.type && objectDescriptor.id) {
                    normalizedObject = objectDescriptor;
                }

                if (normalizedObject) {
                    if (pushHistory && objectToEdit) {
                        setNavigationHistory((prev) => [...prev, objectToEdit]);
                    }
                    setObjectToEdit(normalizedObject);
                }
            }

            setActiveTab("edit");
        },
        [objectToEdit],
    );

    /**
     * Called from ObjectTable when user clicks an object row.
     */
    const handleEditObject = useCallback(
        (objectDetails) => {
            navigateToObject(objectDetails, { pushHistory: true });
        },
        [navigateToObject],
    );

    /**
     * Called from EditObject when clicking UUID links / association links.
     * The feederId context flows from the current object being viewed.
     */
    const handleNavigate = useCallback(
        (value, currentFeederId) => {
            if (graphHelper.isCIM) {
                navigateToObject({ mRID: value, feederId: currentFeederId }, { pushHistory: true });
            } else {
                navigateToObject({ id: value }, { pushHistory: true });
            }
        },
        [navigateToObject],
    );

    /**
     * Go back in navigation history
     */
    const handleGoBack = useCallback(() => {
        if (navigationHistory.length === 0) return;

        const previous = navigationHistory[navigationHistory.length - 1];
        setNavigationHistory((prev) => prev.slice(0, -1));
        setObjectToEdit(previous);
    }, [navigationHistory]);

    const tabItems = [
        {
            key: "edges",
            label: `Edges (${filteredEdges.length})`,
            children: (
                <div className="object-studio-tab-content">
                    <ObjectTable
                        data={filteredEdges}
                        columns={edgeColumns}
                        onEditObject={handleEditObject}
                        isCIM={graphHelper.isCIM}
                    />
                </div>
            ),
        },
        {
            key: "nodes",
            label: `Nodes (${filteredNodes.length})`,
            children: (
                <div className="object-studio-tab-content">
                    <ObjectTable
                        data={filteredNodes}
                        columns={nodeColumns}
                        onEditObject={handleEditObject}
                        isCIM={graphHelper.isCIM}
                    />
                </div>
            ),
        },
        {
            key: "edit",
            label: "Edit Object",
            children: (
                <div className="object-studio-tab-content">
                    {objectToEdit ? (
                        <div>
                            {navigationHistory.length > 0 && (
                                <Button
                                    type="link"
                                    icon={<ArrowLeftOutlined />}
                                    onClick={handleGoBack}
                                    style={{ marginBottom: "0.5rem" }}
                                >
                                    Back ({navigationHistory.length})
                                </Button>
                            )}
                            <EditObject object={objectToEdit} onNavigate={handleNavigate} />
                        </div>
                    ) : (
                        <Typography.Text type="secondary">
                            Select a node or edge from the table to edit
                        </Typography.Text>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="object-studio">
            <div className="object-studio-header">
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setView("graph")}>
                    Back to Graph
                </Button>
                <Typography.Title level={4} style={{ margin: 0 }}>
                    Object Studio
                </Typography.Title>
            </div>
            <Splitter className="object-studio-body">
                <Splitter.Panel
                    defaultSize="20%"
                    min="15%"
                    max="30%"
                    className="object-studio-left-pane"
                >
                    <ObjectTypesPane
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        filterTypes={filterTypes}
                        setFilterTypes={setFilterTypes}
                    />
                </Splitter.Panel>
                <Splitter.Panel className="object-studio-right-pane">
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={tabItems}
                        className="object-studio-tabs"
                    />
                </Splitter.Panel>
            </Splitter>
        </div>
    );
};

export default ObjectStudio;
