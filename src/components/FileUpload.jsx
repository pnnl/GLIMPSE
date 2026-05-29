import React, { useState } from "react";
import { Upload, Progress } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";

const { Dragger } = Upload;

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

const validateFiles = async (paths) => {
    const categorized = categorizeFiles(paths);
    const hasTheme = categorized.theme.length > 0;
    const hasGlm = categorized.glm.length > 0;
    const hasXml = categorized.xml.length > 0;
    const hasJson = categorized.json.length > 0;
    const dataFiles = paths.filter((p) => !isThemeFile(p));

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
    const { newGraphUpdate } = useGraph();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const uploadFiles = async (files) => {
        if (!files || files.length === 0) return;

        const filenames = files.map((f) => f.name);
        const endPoint = await validateFiles(filenames);

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        try {
            setUploading(true);
            setProgress(0);

            const { data: response } = await axios.post(`http://127.0.0.1:5051/${endPoint}`, formData, {
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

            graphHelper.isCIM = endPoint === "api/upload/cim";
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

    // beforeUpload is called once per file in a batch; fileList contains the full
    // batch. We wait for the last file to trigger a single grouped upload.
    const beforeUpload = (file, fileList) => {
        if (file === fileList[fileList.length - 1]) {
            uploadFiles(fileList);
        }
        return false;
    };

    return (
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
            {uploading && (
                <div style={{ padding: "0 24px", marginTop: 8 }}>
                    <Progress percent={progress} size="small" />
                </div>
            )}
        </Dragger>
    );
};

export default FileUpload;
