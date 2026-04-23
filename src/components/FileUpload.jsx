import React, { useRef, useState } from "react";
import "../styles/FileUpload.css";
import { Card, Progress } from "antd";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
// import { useNavigate } from "react-router";
const { Meta } = Card;

const cardStyles = {
    display: "flex",
    border: "1px dashed #333",
    height: "12rem",
    width: "20rem",
    margin: "2rem 0",
    borderRadius: "25px",
    justifyContent: "center",
    alignItems: "center",
};

const isThemeFile = (path) => {
    const parts = path.split(".");
    return (
        parts.length >= 3 &&
        parts[parts.length - 2] === "theme" &&
        parts[parts.length - 1] === "json"
    );
};
const isGlmFile = (path) => path.split(".").pop() === "glm";
const isJsonFile = (path) => path.split(".").pop() === "json";
const isXmlFile = (path) => {
    const fileExtension = path.split(".").pop();
    return fileExtension === "xml" || fileExtension === "XML";
};

const categorizeFiles = (paths) => {
    const categorized = {
        theme: [],
        glm: [],
        json: [],
        xml: [],
        other: [],
    };

    paths.forEach((path) => {
        if (isThemeFile(path)) {
            categorized.theme.push(path);
        } else if (isGlmFile(path)) {
            categorized.glm.push(path);
        } else if (isXmlFile(path)) {
            categorized.xml.push(path);
        } else if (isJsonFile(path)) {
            categorized.json.push(path);
        } else {
            categorized.other.push(path);
        }
    });

    return categorized;
};

const validateFiles = async (paths) => {
    const categorized = categorizeFiles(paths);
    const hasTheme = categorized.theme.length > 0;
    const hasGlm = categorized.glm.length > 0;
    const hasXml = categorized.xml.length > 0;
    const hasJson = categorized.json.length > 0;
    const dataFiles = paths.filter((p) => !isThemeFile(p));

    // Check if all data files are of the same type
    if (dataFiles.every(isGlmFile) || (hasGlm && (hasTheme || (!hasXml && !hasJson)))) {
        return "api/upload/glm";
    } else if (dataFiles.every(isXmlFile) || (hasXml && (hasTheme || (!hasGlm && !hasJson)))) {
        return "api/upload/cim";
    } else if (dataFiles.every(isJsonFile) && !hasGlm && !hasXml) {
        return "api/upload/json";
    } else {
        const msg =
            "Upload glm or xml files with an optional <filename>.theme.json theme file, or upload only JSON data files with an optional theme file";
        alert(msg);
        throw new Error(msg);
    }
};

const FileUpload = ({ closeModal }) => {
    // const navigate = useNavigate();
    const { newGraphUpdate } = useGraph();
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const uploadFiles = async (fileList) => {
        console.log("Initial fileList.length:", fileList.length);
        if (!fileList || fileList.length === 0) return;
        // Convert to array immediately to avoid FileList issues
        const filesArray = Array.from(fileList);

        const filenames = filesArray.map((file) => file.name);
        console.log("Filenames:", filenames);

        const endPoint = await validateFiles(filenames);

        const formData = new FormData();
        filesArray.forEach((file) => {
            formData.append("files", file);
        });

        try {
            setUploading(true);
            setProgress(0);

            const { data: response } = await axios.post(
                `http://127.0.0.1:5051/${endPoint}`,
                formData,
                {
                    onUploadProgress: (progressEvent) => {
                        if (!progressEvent.total) return;
                        setProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                    },
                },
            );

            if ("error" in response) throw new Error(response.error);

            if (graphHelper.graph.order > 0) {
                graphHelper.clearGraphData();
                window.dispatchEvent(new CustomEvent("graph-cleared"));
            }

            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setGraphData(response.data ?? response);

            window.dispatchEvent(new CustomEvent("graph-loaded"));
            newGraphUpdate();
            closeModal();
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
            setTimeout(() => setProgress(0), 500);
        }
    };

    const handleFileUpload = (e) => {
        uploadFiles(e.target.files);
        // reset input so same file can be selected again if needed
        e.target.value = null;
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadFiles(e.dataTransfer.files);
        e.target.value = null;
        setDragActive(false);
    };

    return (
        <div className="file-upload-container">
            <Card
                hoverable
                style={{ ...cardStyles, background: dragActive ? "#fafafa" : "inherit" }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    multiple
                    onChange={handleFileUpload}
                />
                <div style={{ width: "100%", textAlign: "center" }}>
                    <Meta
                        title="File Upload"
                        description="Drag and Drop files here or click to upload"
                    />
                    {uploading && (
                        <div style={{ marginTop: 12 }}>
                            <Progress percent={progress} size="small" />
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default FileUpload;
