import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Modal, Tabs, Button, Alert } from "antd";
import axios from "axios";
import FileUpload from "../FileUpload";
import ExampleModels from "../ExampleModels";
import GridAPPSDModelForm from "../forms/GridAPPSDModelForm";
import graphHelper from "../../graph-helper/GraphHelper";
import socketClientHelper from "../../socket-client-helper/SocketClientHelper";
import { useGraph } from "../../contexts/GraphContext";
import { API_BASE_URL } from "../../config";
import { confirmDiscardChanges, errorText } from "../../utils/notify";

const LoadModelModal = ({ onMount }) => {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);
    const [loadProgress, setLoadProgress] = useState(null);
    const [selectedGridappsdModels, setSelectedGridappsdModels] = useState(null);
    const [gridappsdAvailable, setGridappsdAvailable] = useState(false);
    const [error, setError] = useState(null);
    const { newGraphUpdate } = useGraph();

    // Stage-by-stage progress emitted by the backend while it pulls a CIM
    // model out of Blazegraph (large models take a while).
    useEffect(() => {
        return socketClientHelper.on("model-load-progress", setLoadProgress);
    }, []);

    // Only offer the GridAPPS-D tab when the broker is actually reachable.
    // Re-checked every time the modal opens so a broker started after app
    // launch is picked up.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        axios
            .get(`${API_BASE_URL}/api/gridappsd/status`)
            .then(({ data }) => {
                if (!cancelled) setGridappsdAvailable(Boolean(data.connected));
            })
            .catch(() => {
                if (!cancelled) setGridappsdAvailable(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open]);

    const handleModelSelect = (selectedModels) => {
        const models = selectedModels.map((m) => JSON.parse(m));
        console.log(models);
        graphHelper.selectedGridappsdModels = models;
        setSelectedGridappsdModels(models);
    };

    const ITEMS = [
        {
            label: "File Upload",
            key: "file-upload",
            children: <FileUpload closeModal={() => setOpen(false)} />,
        },
        {
            label: "Example Models",
            key: "example-models",
            children: <ExampleModels closeModal={() => setOpen(false)} />,
        },
        // Hidden entirely when the broker isn't reachable (see the status
        // check above).
        ...(gridappsdAvailable
            ? [
                  {
                      label: "Load w/ GridAPPS-D",
                      key: "load-gridappsd",
                      children: (
                          <GridAPPSDModelForm
                              initialConnected
                              onModelSelect={handleModelSelect}
                          />
                      ),
                  },
              ]
            : []),
    ];

    useEffect(() => {
        if (onMount) {
            onMount(setOpen);
        }
    }, [onMount]);

    const close = () => setOpen(false);

    const handleLoad = async () => {
        setError(null);

        // Loading replaces the whole graph — don't silently drop edits.
        if (!(await confirmDiscardChanges("Loading a model"))) return;

        setLoading(true);

        try {
            const resPromise = axios.post(
                `${API_BASE_URL}/api/gridappsd/models`,
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
            graphHelper.setIsCIM(true);
            graphHelper.setThemeObject(response.themeData ?? null);
            graphHelper.setGraphData(response.data ?? response);
            newGraphUpdate();
            window.dispatchEvent(
                new CustomEvent("graph-loaded", { detail: { source: "gridappsd" } }),
            );
            // Drop any previous run first (stops it, clears its id and logs), then
            // flip to idle: only a model loaded through GridAPPS-D gets the
            // simulation lifecycle controls and log panel, and they gate on this
            // state (VisToolbar / GraphLayout).
            socketClientHelper.detachSimulation();
            socketClientHelper.setSimulationState("idle");
            setOpen(false);
        } catch (e) {
            // Inline (not a toast): a CIM pull can take minutes, and the user is
            // still looking at this modal when it fails.
            console.error("GridAPPS-D model load failed:", e);
            setError(
                errorText(e, "The server could not build a graph from the selected model(s)."),
            );
        } finally {
            setLoading(false);
            setLoadProgress(null);
        }
    };

    const modalFooter = [
        loading && loadProgress && (
            <span key={"load-progress"} style={{ marginRight: 12 }}>
                {`Loading ${loadProgress.stage}… (${loadProgress.step}/${loadProgress.total})`}
            </span>
        ),
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
            {error && (
                <Alert
                    type="error"
                    showIcon
                    title="Could not load model"
                    description={error}
                    closable={{ onClose: () => setError(null) }}
                    style={{ marginBottom: "1rem" }}
                />
            )}
            <Tabs type="card" items={ITEMS} />
        </Modal>,
        document.getElementById("portal"),
    );
};

export default LoadModelModal;
