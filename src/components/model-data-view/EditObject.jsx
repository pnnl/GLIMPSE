import { useEffect, useState } from "react";
import { Tabs, Spin, Typography } from "antd";
import axios from "axios";
import AttributesTable from "./AttributesTable";
import MermaidDiagram from "./MermaidDiagram";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import { API_BASE_URL } from "../../config";
import { formatVoltageLines, formatPowerLines } from "../../utils/live-measurements";
import { errorText, notify } from "../../utils/notify";

// Split a formatted "A 2401.3 V" / "A 12.30 kW, 4.50 kVAR" line into a
// { attrKey, value } row keyed by measurement kind + phase for the table.
const toLiveRows = (kind, lines) =>
    lines.map((line) => {
        const spaceIdx = line.indexOf(" ");
        const phase = spaceIdx === -1 ? line : line.slice(0, spaceIdx);
        const value = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1);
        return { attrKey: `${kind} ${phase}`, value };
    });

const READ_ONLY_ATTRIBUTES = new Set([
    "name",
    "identifier",
    "mRID",
    "to",
    "from",
    "ConnectivityNodeContainer",
    "feeder_id", // feeder_id should never be editable
]);

const mermaidCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const getCacheKey = (feederId, mRID) => `${feederId}::${mRID}`;

const getCachedMermaid = (feederId, mRID) => {
    const key = getCacheKey(feederId, mRID);
    const cached = mermaidCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    mermaidCache.delete(key);
    return null;
};

const detailFromGraph = (object) => {
    const { type, id, mRID } = object;
    const graphId = mRID ?? id;
    let attrs = null;
    if (graphHelper.graph.hasEdge(graphId)) attrs = graphHelper.graph.getEdgeAttributes(graphId);
    else if (graphHelper.graph.hasNode(graphId)) attrs = graphHelper.graph.getNodeAttributes(graphId);
    if (!attrs) return null;
    return { id: graphId, elementType: type, attributes: { ...attrs.attributes }, associations: {} };
};

const Centered = ({ children }) => (
    <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>{children}</div>
);

const EditObject = ({ object, onNavigate, simActive = false }) => {
    const { newGraphUpdate } = useGraph();
    const isCIM = graphHelper.isCIM;

    // The parent remounts this component (via key) for each object viewed, so
    // these initializers run per object. CIM details normally came down with the
    // model, so attributes usually need no loading state at all.
    const [objectToEdit, setObjectToEdit] = useState(() => {
        if (!object) return null;

        if (isCIM) {
            const detail = graphHelper.getObjectDetail(object.feederId, object.mRID);
            if (!detail) return detailFromGraph(object);
            return { ...detail, _feederId: object.feederId, _mRID: object.mRID };
        }

        const { type, id } = object;
        const attrs =
            type === "edge"
                ? graphHelper.graph.getEdgeAttributes(id)
                : graphHelper.graph.getNodeAttributes(id);
        return { id, elementType: type, attributes: { ...attrs.attributes } };
    });
    const [mermaidContent, setMermaidContent] = useState(() =>
        object && isCIM ? getCachedMermaid(object.feederId, object.mRID) : null,
    );
    const [mermaidLoading, setMermaidLoading] = useState(
        () => Boolean(object) && isCIM && !getCachedMermaid(object.feederId, object.mRID),
    );
    // Set when this object had no detail record shipped with the model, so one
    // has to be fetched. See the effect below.
    const [detailLoading, setDetailLoading] = useState(
        () => Boolean(object?.mRID && object?.feederId) && isCIM && !objectToEdit,
    );
    const [detailError, setDetailError] = useState(null);

    useEffect(() => {
        if (!object || !isCIM || objectToEdit) return;

        // Without both ids there is nothing to ask for; detailLoading was
        // initialized false for exactly this case.
        const { feederId, mRID } = object;
        if (!feederId || !mRID) return;

        let cancelled = false;

        const fetchDetail = async () => {
            try {
                const { data } = await axios.post(`${API_BASE_URL}/api/cim/objects`, {
                    feeder_id: feederId,
                    mRID,
                });
                // Same shape the model ships (both come from _object_to_detail).
                if (!cancelled) setObjectToEdit({ ...data.object, _feederId: feederId, _mRID: mRID });
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to fetch object:", error);
                setDetailError(errorText(error, "This object could not be loaded."));
                setDetailLoading(false);
            }
        };

        fetchDetail();
        return () => {
            cancelled = true;
        };
    }, [object, isCIM, objectToEdit]);

    // Diagram only — the object's attributes and associations are already resolved.
    useEffect(() => {
        if (!object || !isCIM) return;

        const { feederId, mRID } = object;

        if (!feederId || !mRID) {
            console.error("EditObject: Missing feederId or mRID", object);
            return;
        }

        if (getCachedMermaid(feederId, mRID)) return;

        let cancelled = false;

        const fetchMermaid = async () => {
            try {
                const { data } = await axios.post(`${API_BASE_URL}/api/cim/objects/mermaid`, {
                    feeder_id: feederId,
                    mRID,
                });
                if (cancelled) return;

                mermaidCache.set(getCacheKey(feederId, mRID), { data: data.mermaid, timestamp: Date.now() });
                setMermaidContent(data.mermaid);
            } catch (error) {
                // The object's own data is already on screen, so a failed
                // diagram degrades the Diagram tab rather than the whole panel.
                if (!cancelled) console.error("Failed to fetch object diagram:", error);
            } finally {
                if (!cancelled) setMermaidLoading(false);
            }
        };

        fetchMermaid();
        return () => {
            cancelled = true;
        };
    }, [object, isCIM]);

    const handleChange = (key, value) => {
        setObjectToEdit((prev) => ({
            ...prev,
            attributes: { ...prev.attributes, [key]: value },
        }));
    };

    const handleSave = async () => {
        try {
            if (isCIM) {
                const feederId = objectToEdit._feederId || objectToEdit.attributes?.feeder_id;
                const mRID = objectToEdit._mRID || objectToEdit.attributes?.mRID;

                const updates = Object.entries(objectToEdit.attributes).filter(
                    ([key]) => !READ_ONLY_ATTRIBUTES.has(key),
                );

                const results = await Promise.allSettled(
                    updates.map(([key, val]) =>
                        axios.put(`${API_BASE_URL}/api/cim/objects`, {
                            attribute: key,
                            value: val,
                            feeder_id: feederId,
                        }),
                    ),
                );

                const failures = results.filter((r) => r.status === "rejected");
                if (failures.length > 0) {
                    notify.warning(`${failures.length} attribute(s) failed to save`);
                } else {
                    notify.success("Object saved successfully");
                }

                // Invalidate so the next visit refetches the diagram
                mermaidCache.delete(getCacheKey(feederId, mRID));
            } else {
                const { type, id } = object;
                const attributes = { ...objectToEdit.attributes };
                if (type === "edge") {
                    graphHelper.graph.setEdgeAttribute(id, "attributes", attributes);
                } else {
                    graphHelper.graph.setNodeAttribute(id, "attributes", attributes);
                }
                newGraphUpdate();
                notify.success("Object saved");
            }
        } catch (error) {
            console.error("Save failed:", error);
            notify.error("Failed to save object");
        }
    };

    if (!objectToEdit) {
        if (detailLoading) {
            return (
                <Centered>
                    <Spin size="large" description="Loading object..." />
                </Centered>
            );
        }
        if (detailError) {
            return (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    <Typography.Text type="secondary">{detailError}</Typography.Text>
                </div>
            );
        }
        return null;
    }

    const currentFeederId =
        objectToEdit._feederId || objectToEdit.attributes?.feeder_id || object?.feederId;

    const heading = objectToEdit.attributes?.name ?? objectToEdit.id ?? String(object?.mRID || object);

    const graphId = object?.mRID ?? object?.id;
    let liveRows = [];
    if (simActive && graphId) {
        if (graphHelper.graph.hasNode(graphId)) {
            liveRows = toLiveRows(
                "voltage",
                formatVoltageLines(graphHelper.liveMeasurements.nodes.get(graphId)?.voltage),
            );
        } else if (graphHelper.graph.hasEdge(graphId)) {
            liveRows = toLiveRows(
                "power",
                formatPowerLines(graphHelper.liveMeasurements.edges.get(graphId)?.power),
            );
        }
    }

    const tabItems = [
        {
            key: "attributes",
            label: "Attributes",
            children: (
                <AttributesTable
                    heading={heading}
                    attributes={objectToEdit.attributes}
                    readOnlyAttributes={READ_ONLY_ATTRIBUTES}
                    onNavigate={onNavigate}
                    onChange={handleChange}
                    onSave={handleSave}
                    feederId={currentFeederId}
                    liveRows={liveRows}
                />
            ),
        },
    ];

    if (isCIM) {
        tabItems.push(
            {
                key: "associations",
                label: "Associations",
                children: (
                    <AttributesTable
                        heading={heading}
                        attributes={objectToEdit.associations}
                        readOnlyAttributes={READ_ONLY_ATTRIBUTES}
                        onNavigate={onNavigate}
                        feederId={currentFeederId}
                    />
                ),
            },
            // Rendered server-side from the live cimgraph object.
            {
                key: "mermaid",
                label: "Diagram",
                children: mermaidLoading ? (
                    <Centered>
                        <Spin size="large" description="Loading diagram..." />
                    </Centered>
                ) : (
                    <MermaidDiagram mermaidContent={mermaidContent} objectID={heading} />
                ),
            },
        );
    }

    return (
        <Tabs items={tabItems} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
    );
};

export default EditObject;
