import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Modal, Tabs, Button, Divider } from "antd";
import axios from "axios";
import FileUpload from "../FileUpload";
import GridAPPSDModelForm from "../forms/GridAPPSDModelForm";
import graphHelper from "../../graph-helper/GraphHelper";
import { useGraph } from "../../contexts/GraphContext";

const LoadModelModal = ({ onMount }) => {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [selectedGridappsdModels, setSelectedGridappsdModels] = useState(null);
    const { newGraphUpdate } = useGraph();

    const handleModelSelect = (selectedModels) => {
        const models = selectedModels.map((m) => JSON.parse(m));
        setSelectedGridappsdModels(models);
    };

    const ITEMS = [
        {
            label: "File Upload",
            key: "file-upload",
            children: <FileUpload closeModal={() => setOpen(false)} />,
        },
        {
            label: "Load w/ GridAPPS-D",
            key: "load-gridappsd",
            children: <GridAPPSDModelForm onModelSelect={handleModelSelect} />,
        },
    ];

    useEffect(() => {
        if (onMount) {
            onMount(setOpen);
        }
    }, [onMount]);

    const close = () => setOpen(false);

    const handleLoad = async () => {
        setLoading(true);

        try {
            const resPromise = axios.post(
                `http://127.0.0.1:5051/api/gridappsd/models`,
                selectedGridappsdModels.map((m) => m.modelId),
                {
                    headers: { "Content-Type": "application/json" },
                },
            );
            const { data: response } = await resPromise;

            if ("error" in response) throw new Error(response.error);

            // Set graph data which triggers clear and render
            if (graphHelper.graph.order > 0) {
                graphHelper.clearGraphData();
                window.dispatchEvent(new CustomEvent("graph-cleared"));
            }

            // Close modal after data is set
            console.log(response);
            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setGraphData(response.data ?? response);
            newGraphUpdate();
            window.dispatchEvent(new CustomEvent("graph-loaded"));
            setOpen(false);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const modalFooter = [
        <Button key={"load-btn"} loading={loading} onClick={handleLoad}>
            Load
        </Button>,
    ];

    return createPortal(
        <Modal
            centered
            footer={selectedGridappsdModels ? modalFooter : []}
            width={750}
            title="Load a Model"
            onCancel={close}
            open={open}
        >
            <Tabs type="card" items={ITEMS} />
        </Modal>,
        document.getElementById("portal"),
    );
};

export default LoadModelModal;
