import React, { useEffect, useState, useCallback, useRef } from "react";
import { Tabs, Spin, message } from "antd";
import axios from "axios";
import AttributesTable from "./AttributesTable";
import MermaidDiagram from "./MermaidDiagram";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";
import { API_BASE_URL } from "../../config";

const READ_ONLY_ATTRIBUTES = new Set([
    "name",
    "identifier",
    "mRID",
    "to",
    "from",
    "ConnectivityNodeContainer",
    "feeder_id", // feeder_id should never be editable
]);

// Simple in-memory cache for CIM object fetches
const objectCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

const getCacheKey = (feederId, mRID) => `${feederId}::${mRID}`;

const getCachedObject = (feederId, mRID) => {
    const key = getCacheKey(feederId, mRID);
    const cached = objectCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    objectCache.delete(key);
    return null;
};

const setCachedObject = (feederId, mRID, data) => {
    const key = getCacheKey(feederId, mRID);
    objectCache.set(key, { data, timestamp: Date.now() });
};

// Invalidate cache for a specific object (after save)
const invalidateCache = (feederId, mRID) => {
    const key = getCacheKey(feederId, mRID);
    objectCache.delete(key);
};

const EditObject = ({ object, onNavigate }) => {
    const { newGraphUpdate } = useGraph();
    const isCIM = graphHelper.isCIM;

    // The parent remounts this component (via key) for each object viewed, so
    // the initializers below run per object: non-CIM objects and cached CIM
    // objects resolve synchronously; everything else starts empty and is
    // filled by the fetch effect.
    const [objectToEdit, setObjectToEdit] = useState(() => {
        if (!object) return null;
        if (isCIM) return getCachedObject(object.feederId, object.mRID)?.objectData ?? null;

        const { type, id } = object;
        const attrs =
            type === "edge"
                ? graphHelper.graph.getEdgeAttributes(id)
                : graphHelper.graph.getNodeAttributes(id);
        return { id, elementType: type, attributes: { ...attrs.attributes } };
    });
    const [mermaidContent, setMermaidContent] = useState(() => {
        if (!object || !isCIM) return null;
        return getCachedObject(object.feederId, object.mRID)?.mermaidData ?? null;
    });
    const [loading, setLoading] = useState(
        () => Boolean(object) && isCIM && !getCachedObject(object.feederId, object.mRID),
    );
    const [saving, setSaving] = useState(false);

    // Track the current request to avoid race conditions
    const requestRef = useRef(0);

    useEffect(() => {
        if (!object || !isCIM) return;

        const { feederId, mRID } = object;

        if (!feederId || !mRID) {
            console.error("EditObject: Missing feederId or mRID", object);
            return;
        }

        // Cache hits were already resolved synchronously by the state
        // initializers (or by a completed fetch for this same object).
        if (getCachedObject(feederId, mRID)) return;

        const currentRequest = ++requestRef.current;

        const fetchCIMData = async () => {
            try {
                const [objRes, mermaidRes] = await Promise.all([
                    axios.post(`${API_BASE_URL}/api/cim/objects`, {
                        feeder_id: feederId,
                        mRID: mRID,
                    }),
                    axios.post(`${API_BASE_URL}/api/cim/objects/mermaid`, {
                        feeder_id: feederId,
                        mRID: mRID,
                    }),
                ]);

                // Guard against stale responses
                if (currentRequest !== requestRef.current) return;

                const objectData = {
                    ...objRes.data.object,
                    // Ensure feederId is always stored with the object
                    _feederId: feederId,
                    _mRID: mRID,
                };
                const mermaidData = mermaidRes.data.mermaid;

                // Cache the result
                setCachedObject(feederId, mRID, { objectData, mermaidData });

                setObjectToEdit(objectData);
                setMermaidContent(mermaidData);
            } catch (error) {
                if (currentRequest !== requestRef.current) return;
                console.error("Failed to fetch CIM object:", error);
                message.error("Failed to load object data");
            } finally {
                if (currentRequest === requestRef.current) {
                    setLoading(false);
                }
            }
        };

        fetchCIMData();
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
                    message.warning(`${failures.length} attribute(s) failed to save`);
                } else {
                    message.success("Object saved successfully");
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
                message.success("Object saved");
            }
        } catch (error) {
            console.error("Save failed:", error);
            message.error("Failed to save object");
        } finally {
            setSaving(false);
        }
    }, [objectToEdit, isCIM, object, newGraphUpdate]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
                <Spin size="large" tip="Loading object..." />
            </div>
        );
    }

    if (!objectToEdit) return null;

    // Derive the feederId to pass down — single source of truth
    const currentFeederId =
        objectToEdit._feederId || objectToEdit.attributes?.feeder_id || object?.feederId;

    const heading = objectToEdit.attributes?.name ?? objectToEdit.id ?? String(object?.mRID || object);

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
                  {
                      key: "mermaid",
                      label: "Diagram",
                      children: <MermaidDiagram mermaidContent={mermaidContent} objectID={heading} />,
                  },
              ]
            : []),
    ];

    return (
        <Tabs items={tabItems} style={{ height: "100%", display: "flex", flexDirection: "column" }} />
    );
};

export default EditObject;
