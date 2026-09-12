import React, { useEffect, useState, useCallback, useRef } from "react";
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

const setCachedMermaid = (feederId, mRID, data) => {
    mermaidCache.set(getCacheKey(feederId, mRID), { data, timestamp: Date.now() });
};

const invalidateCache = (feederId, mRID) => {
    mermaidCache.delete(getCacheKey(feederId, mRID));
};

const detailFromGraph = (object) => {
    const { type, id, mRID } = object;
    const graphId = mRID ?? id;
    const attrs = graphHelper.graph.hasEdge(graphId)
        ? graphHelper.graph.getEdgeAttributes(graphId)
        : graphHelper.graph.hasNode(graphId)
          ? graphHelper.graph.getNodeAttributes(graphId)
          : null;
    if (!attrs) return null;
    return { id: graphId, elementType: type, attributes: { ...attrs.attributes }, associations: {} };
};

const EditObject = ({ object, onNavigate, simActive = false }) => {
    const { newGraphUpdate } = useGraph();
    const isCIM = graphHelper.isCIM;

    // The parent remounts this component (via key) for each object viewed, so
    // these initializers run per object. Everything an object needs to render is
    // already in memory — CIM details came down with the model — so there is no
    // loading state for attributes at all.
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
    const [mermaidContent, setMermaidContent] = useState(() => {
        if (!object || !isCIM) return null;
        return getCachedMermaid(object.feederId, object.mRID);
    });
    const [mermaidLoading, setMermaidLoading] = useState(
        () => Boolean(object) && isCIM && !getCachedMermaid(object.feederId, object.mRID),
    );
    const [saving, setSaving] = useState(false);
    // Set when this object had no detail record shipped with the model, so one
    // has to be fetched. See the effect below.
    const [detailLoading, setDetailLoading] = useState(
        () =>
            Boolean(object?.mRID && object?.feederId) && isCIM && !objectToEdit,
    );
    const [detailError, setDetailError] = useState(null);

    // Track the current request to avoid race conditions
    const requestRef = useRef(0);
    const detailRequestRef = useRef(0);

    useEffect(() => {
        if (!object || !isCIM || objectToEdit) return;

        // Without both ids there is nothing to ask for; detailLoading was
        // initialized false for exactly this case, so there is no state to undo.
        const { feederId, mRID } = object;
        if (!feederId || !mRID) return;

        const currentRequest = ++detailRequestRef.current;

        const fetchDetail = async () => {
            try {
                const { data } = await axios.post(`${API_BASE_URL}/api/cim/objects`, {
                    feeder_id: feederId,
                    mRID: mRID,
                });

                // Guard against stale responses
                if (currentRequest !== detailRequestRef.current) return;

                // Same shape the model ships (both come from _object_to_detail),
                // so everything downstream treats it identically.
                setObjectToEdit({ ...data.object, _feederId: feederId, _mRID: mRID });
            } catch (error) {
                if (currentRequest !== detailRequestRef.current) return;
                console.error("Failed to fetch object:", error);
                setDetailError(errorText(error, "This object could not be loaded."));
            } finally {
                if (currentRequest === detailRequestRef.current) {
                    setDetailLoading(false);
                }
            }
        };

        fetchDetail();
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

        const currentRequest = ++requestRef.current;

        const fetchMermaid = async () => {
            try {
                const { data } = await axios.post(`${API_BASE_URL}/api/cim/objects/mermaid`, {
                    feeder_id: feederId,
                    mRID: mRID,
                });

                // Guard against stale responses
                if (currentRequest !== requestRef.current) return;

                setCachedMermaid(feederId, mRID, data.mermaid);
                setMermaidContent(data.mermaid);
            } catch (error) {
                if (currentRequest !== requestRef.current) return;
                // The object's own data is already on screen, so a failed
                // diagram degrades the Diagram tab rather than the whole panel.
                console.error("Failed to fetch object diagram:", error);
            } finally {
                if (currentRequest === requestRef.current) {
                    setMermaidLoading(false);
                }
            }
        };

        fetchMermaid();
    }, [object, isCIM]);

    const handleChange = useCallback((key, value) => {
        setObjectToEdit((prev) => ({
            ...prev,
            attributes: { ...prev.attributes, [key]: value },
        }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!objectToEdit) return;

        setSaving(true);

        try {
            if (isCIM) {
                const feederId = objectToEdit._feederId || objectToEdit.attributes?.feeder_id;
                const mRID = objectToEdit._mRID || objectToEdit.attributes?.mRID;

                // Batch save: collect all non-read-only attributes
                const updates = Object.entries(objectToEdit.attributes).filter(
                    ([key]) => !READ_ONLY_ATTRIBUTES.has(key),
                );

                // Save sequentially to maintain order (or use Promise.all for speed)
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

                // Invalidate cache so next fetch gets fresh data
                invalidateCache(feederId, mRID);
            } else {
                const { type, id } = object;
                if (type === "edge") {
                    graphHelper.graph.setEdgeAttribute(id, "attributes", {
                        ...objectToEdit.attributes,
                    });
                } else {
                    graphHelper.graph.setNodeAttribute(id, "attributes", {
                        ...objectToEdit.attributes,
                    });
                }
                newGraphUpdate();
                notify.success("Object saved");
            }
        } catch (error) {
            console.error("Save failed:", error);
            notify.error("Failed to save object");
        } finally {
            setSaving(false);
        }
    }, [objectToEdit, isCIM, object, newGraphUpdate]);

    if (!objectToEdit) {
        if (detailLoading) {
            return (
                <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                    <Spin size="large" description="Loading object..." />
                </div>
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

    // Derive the feederId to pass down — single source of truth
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
                    saving={saving}
                    liveRows={liveRows}
                />
            ),
        },
        ...(isCIM
            ? [
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
                          <div
                              style={{
                                  display: "flex",
                                  justifyContent: "center",
                                  padding: "3rem",
                              }}
                          >
                              <Spin size="large" description="Loading diagram..." />
                          </div>
                      ) : (
                          <MermaidDiagram mermaidContent={mermaidContent} objectID={heading} />
                      ),
                  },
              ]
            : []),
    ];

    return (
        <Tabs items={tabItems} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
    );
};

export default EditObject;
