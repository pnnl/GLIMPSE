import React, { useState, useMemo, useCallback } from "react";
import { Splitter, Tabs, Button, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import ObjectTypesPane from "./ObjectTypesPane";
import ObjectTable from "./ObjectTable";
import EditObject from "./EditObject";
import UpdateDeviceModal from "../modals/UpdateDeviceModal";
import UpdateRegulatorModal from "../modals/UpdateRegulatorModal";
import { useSimLiveTick } from "../../hooks/useSimLiveTick";
import "./ModelDataView.css";

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
    const { graphUpdateTrigger, setView, darkMode } = useGraph();
    const [activeTab, setActiveTab] = useState("edges");
    const [filterTypes, setFilterTypes] = useState(null);

    // Navigation state: current object + history stack
    const [objectToEdit, setObjectToEdit] = useState(null);
    const [navigationHistory, setNavigationHistory] = useState([]);

    // Live device-control modal state (GridAPPS-D / CIM only). `type` is one of
    // "switch" | "capacitor" | "regulator"; `object` is the graph node/edge key.
    const [controlContext, setControlContext] = useState({ open: false, object: null, type: null });

    // Drives re-render as simulation frames arrive so the live voltage/power
    // columns (and the Edit Object attributes) reflect the latest measurements.
    // `simActive` gates the live UI to the running/paused simulation lifecycle.
    const { simActive } = useSimLiveTick();

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
        // graphUpdateTrigger is the app-wide invalidation counter for the
        // module-singleton graph (bumped by newGraphUpdate after mutations) —
        // it's intentionally a dep even though it isn't read in the callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
     * Open the appropriate live-control modal for a device row. Switches and
     * capacitors use the open/close modal; regulators use the tap-changer modal.
     * The record's graph key (record.id) is what the modals read/mutate.
     */
    const handleControlObject = useCallback((record, controlType) => {
        setControlContext({ open: true, object: record.id, type: controlType });
    }, []);

    const closeControlModal = useCallback(
        () => setControlContext({ open: false, object: null, type: null }),
        [],
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
                        onControlObject={handleControlObject}
                        isCIM={graphHelper.isCIM}
                        elementType="edge"
                        simActive={simActive}
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
                        onControlObject={handleControlObject}
                        isCIM={graphHelper.isCIM}
                        elementType="node"
                        simActive={simActive}
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
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                            {navigationHistory.length > 0 && (
                                <Button
                                    type="link"
                                    icon={<ArrowLeftOutlined />}
                                    onClick={handleGoBack}
                                    style={{
                                        flexShrink: 0,
                                        alignSelf: "flex-start",
                                        marginBottom: "0.5rem",
                                    }}
                                >
                                    Back ({navigationHistory.length})
                                </Button>
                            )}
                            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                                {/* Keyed per object so EditObject remounts (and its
                                    state initializers re-run) on every navigation. */}
                                <EditObject
                                    key={`${objectToEdit.feederId ?? ""}::${objectToEdit.mRID ?? objectToEdit.id}`}
                                    object={objectToEdit}
                                    onNavigate={handleNavigate}
                                    simActive={simActive}
                                />
                            </div>
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
        <div className={`object-studio${darkMode ? " dark-mode" : ""}`}>
            <div className="object-studio-header">
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setView("graph")}>
                    Back to Graph
                </Button>
                <Typography.Title level={4} style={{ margin: 0 }}>
                    Model Data View
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

            {/* Live device-control modals — reused from the graph view. They read
                the current device state off the graph and emit sim-input updates,
                with Save gated to a running GridAPPS-D simulation. */}
            <UpdateDeviceModal
                open={controlContext.open && controlContext.type !== "regulator"}
                object={controlContext.object}
                deviceType={controlContext.type}
                close={closeControlModal}
            />
            <UpdateRegulatorModal
                open={controlContext.open && controlContext.type === "regulator"}
                object={controlContext.object}
                close={closeControlModal}
            />
        </div>
    );
};

export default ObjectStudio;
