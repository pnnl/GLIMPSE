import React, { useEffect, useRef, useState } from "react";
import { Upload, Progress, Alert, Button } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
import socketClientHelper from "../socket-client-helper/SocketClientHelper";
import { API_BASE_URL, PARSE_TIMEOUT_MS } from "../config";
import { confirmDiscardChanges, errorText } from "../utils/notify";

const { Dragger } = Upload;

const MIXED_FILES_MESSAGE =
    "Upload .glm or .xml files with an optional <filename>.theme.json theme file, or " +
    "upload only .json data files with an optional theme file. Formats can't be mixed " +
    "in one upload.";

const isThemeFile = (path) => {
    const parts = path.split(".");
    return (
        parts.length >= 3 && parts[parts.length - 2] === "theme" && parts[parts.length - 1] === "json"
    );
};
const isGlmFile = (path) => path.split(".").pop() === "glm";
const isJsonFile = (path) => path.split(".").pop() === "json";
const isXmlFile = (path) => {
    const fileExtension = path.split(".").pop();
    return fileExtension === "xml" || fileExtension === "XML";
};

const categorizeFiles = (paths) => {
    const categorized = { theme: [], glm: [], json: [], xml: [], other: [] };
    paths.forEach((path) => {
        if (isThemeFile(path)) categorized.theme.push(path);
        else if (isGlmFile(path)) categorized.glm.push(path);
        else if (isXmlFile(path)) categorized.xml.push(path);
        else if (isJsonFile(path)) categorized.json.push(path);
        else categorized.other.push(path);
    });
    return categorized;
};

/**
 * Picks the upload endpoint for a batch of filenames.
 * @returns {{ endpoint: string } | { error: string }} — never throws, so the
 *   caller can render the problem inline instead of interrupting with a dialog.
 */
const resolveEndpoint = (paths) => {
    const categorized = categorizeFiles(paths);
    const hasTheme = categorized.theme.length > 0;
    const hasGlm = categorized.glm.length > 0;
    const hasXml = categorized.xml.length > 0;
    const hasJson = categorized.json.length > 0;
    const dataFiles = paths.filter((p) => !isThemeFile(p));

    if (dataFiles.length === 0) {
        return {
            error: hasTheme
                ? "A theme file on its own has nothing to style — add the .glm, .xml, or .json model file it belongs to."
                : "No model files were selected.",
        };
    }

    if (categorized.other.length > 0) {
        const names = categorized.other.join(", ");
        return { error: `Unsupported file type: ${names}. GLIMPSE reads .glm, .xml, and .json models.` };
    }

    if (dataFiles.every(isGlmFile) || (hasGlm && (hasTheme || (!hasXml && !hasJson)))) {
        return { endpoint: "api/upload/glm" };
    }
    if (dataFiles.every(isXmlFile) || (hasXml && (hasTheme || (!hasGlm && !hasJson)))) {
        return { endpoint: "api/upload/cim" };
    }
    if (dataFiles.every(isJsonFile) && !hasGlm && !hasXml) {
        return { endpoint: "api/upload/json" };
    }

    return { error: MIXED_FILES_MESSAGE };
};

const FileUpload = ({ closeModal }) => {
    const { newGraphUpdate } = useGraph();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    // Set once the bytes are up and the server is parsing. Distinct from
    // `progress`, which only tracks the transfer — a big CIM model spends
    // seconds uploading and minutes parsing.
    const [error, setError] = useState(null);
    // Aborts the upload and the job poll together — on unmount, and on Cancel.
    const abortRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(
        () => () => {
            abortRef.current?.abort();
            clearTimeout(timerRef.current);
        },
        [],
    );

    const cancelUpload = () => abortRef.current?.abort();

    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;
        // One upload at a time: a second batch dropped mid-parse would clear the
        // graph out from under the first.
        if (abortRef.current) return;

        setError(null);

        const { endpoint, error: validationError } = resolveEndpoint(files.map((f) => f.name));
        if (validationError) {
            setError(validationError);
            return;
        }

        // Loading replaces the whole graph — don't silently drop edits.
        if (!(await confirmDiscardChanges("Loading a model"))) return;

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            setUploading(true);
            setProgress(0);

            const { data: response } = await axios.post(`${API_BASE_URL}/${endpoint}`, formData, {
                signal: controller.signal,
                timeout: PARSE_TIMEOUT_MS,
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) return;
                    setProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                },
            });

            if ("error" in response) throw new Error(response.error);

            if (graphHelper.graph.order > 0) {
                graphHelper.clearGraphData();
                window.dispatchEvent(new CustomEvent("graph-cleared"));
            }

            graphHelper.isCIM = endpoint === "api/upload/cim";
            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setObjectDetails(response.objectDetails);
            const modelData = response.data ?? response;
            graphHelper.setGraphData(modelData);

            // A file-uploaded model isn't driveable via GridAPPS-D, so detach
            // from any previous run: hides the controls/log/charts/id badge and
            // stops a simulation that would otherwise stream into this graph.
            socketClientHelper.detachSimulation();

            window.dispatchEvent(new CustomEvent("graph-loaded", { detail: { source: "file-upload" } }));
            newGraphUpdate();
            closeModal();
        } catch (err) {
            // Shown inline rather than as a toast: the modal stays open, so the
            // message sits right next to the drop zone the user will retry in.
            console.error("Model upload failed:", err);
            // A 413 here is usually not ours: GitHub Codespaces caps a forwarded
            // port's request body at 16 MB, so a large model is rejected at the
            // edge and never reaches the backend. The raw nginx HTML that comes
            // back says nothing useful, so name the real constraint and the way
            // around it.
            if (controller.signal.aborted) {
                // The user cancelled, or the modal closed. Not a failure.
            } else if (err?.response?.status === 413) {
                setError(
                    "This model is too large to upload over the network (the limit is about 16 MB " +
                        "in a browser-hosted Codespace). Load a bundled model from Example Models " +
                        "instead, or run GLIMPSE locally to open files of any size.",
                );
            } else if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
                setError(
                    "The server stopped responding while handling this model. It may still be " +
                        "parsing, or it may have run out of memory — check that the backend is " +
                        "running, then try again.",
                );
            } else {
                setError(errorText(err, "The server could not parse these files."));
            }
        } finally {
            abortRef.current = null;
            setUploading(false);
            timerRef.current = setTimeout(() => setProgress(0), 500);
        }
    };

    // beforeUpload is called once per file in a batch; fileList contains the full
    // batch. We wait for the last file to trigger a single grouped upload.
    const beforeUpload = (file, fileList) => {
        if (file === fileList[fileList.length - 1]) {
            uploadFiles(fileList);
        }
        return false;
    };

    return (
        <>
            {error && (
                <Alert
                    type="error"
                    showIcon
                    title="Upload failed"
                    description={error}
                    closable={{ onClose: () => setError(null) }}
                    style={{ marginTop: "1rem" }}
                />
            )}
            <Dragger
                multiple
                beforeUpload={beforeUpload}
                showUploadList={false}
                disabled={uploading}
                style={{ margin: "2rem 0", borderRadius: "25px" }}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">File Upload</p>
                <p className="ant-upload-hint">Drag and drop files here or click to browse</p>
                <p className="ant-upload-hint" style={{ fontSize: 12, opacity: 0.7 }}>
                    Accepts .glm, .xml (CIM), or .json — plus an optional &lt;filename&gt;.theme.json
                </p>
                {uploading && (
                    <div style={{ padding: "0 24px", marginTop: 8 }}>
                        {progress === 100 ? (
                            <>
                                <Progress percent={100} size="small" status="active" showInfo={false} />
                                <p className="ant-upload-hint" style={{ fontSize: 12, marginTop: 4 }}>
                                    Parsing model…
                                </p>
                            </>
                        ) : (
                            <Progress percent={progress} size="small" />
                        )}
                        <Button
                            size="small"
                            type="text"
                            style={{ marginTop: 4 }}
                            onClick={(e) => {
                                e.stopPropagation();
                                cancelUpload();
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </Dragger>
        </>
    );
};

export default FileUpload;
