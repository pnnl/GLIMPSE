import { useEffect, useState } from "react";
import { Alert, App as AntApp, Button, ConfigProvider, Result, Spin, Typography } from "antd";
import "../src/styles/App.css";
import "../src/styles/AppHeader.css";
import { GraphProvider, useGraph } from "../src/contexts/GraphContext";
import { replaceModel } from "../src/components/modals/load-model";
import ModelSearch from "../src/components/ModelSearch";
import ShortcutsModal from "../src/components/modals/ShortcutsModal";
import { SHORTCUTS, useShortcut } from "../src/hooks/useShortcut";
import { goToNext, goToPrevious, resetHighlight } from "../src/graph-helper/highlight-nav";
import { setMoreAttributesHint } from "../src/utils/canvas-utils";
import LiteGraph from "./LiteGraph";

setMoreAttributesHint(false);

const MODELS = {
    ieee123: "IEEE 123 Node Test Feeder (CIM)",
    ieee3000: "3000 Bus GridLAB-D Model",
};

const requested = new URLSearchParams(window.location.search).get("model");
const modelName = requested in MODELS ? requested : "ieee123";
// Simulation, layout settings and dark mode are not part of the lite viewer.
const LITE_SHORTCUTS = SHORTCUTS.filter(({ combo }) => !["v", "Ctrl+P", "d"].includes(combo));
// The portal serves this page at /models/{id}/explore.
const portalModelId = window.location.pathname.match(/^\/models\/([^/]+)\/explore/)?.[1];

const LiteContent = () => {
    const { newGraphUpdate } = useGraph();
    const [status, setStatus] = useState("loading");
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    useShortcut("n", goToNext);
    useShortcut("p", goToPrevious);
    useShortcut("r", resetHighlight);
    useShortcut("?", () => setShortcutsOpen(true));

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}models/${modelName}.json`)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((response) => {
                replaceModel(response, response.isCIM);
                window.dispatchEvent(new CustomEvent("graph-loaded", { detail: { source: "lite" } }));
                newGraphUpdate();
                setStatus("ready");
            })
            .catch((e) => {
                console.error("GLIMPSE-lite model load failed:", e);
                setStatus("error");
            });
    }, [newGraphUpdate]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <header className="app-header">
                <img className="nav-logo" src={`${import.meta.env.BASE_URL}GLIMPSE_logo.png`} alt="GLIMPSE" />
                <Typography.Text strong>{MODELS[modelName]}</Typography.Text>
                <ModelSearch style={{ marginLeft: "auto" }} />
                <Button onClick={() => setShortcutsOpen(true)}>Shortcuts (?)</Button>
            </header>
            {portalModelId && (
                <Alert
                    type="info"
                    banner
                    title={`Prototype: this preview shows the ${MODELS[modelName]} sample model, not ${decodeURIComponent(portalModelId)}.`}
                />
            )}
            <ShortcutsModal open={shortcutsOpen} close={() => setShortcutsOpen(false)} shortcuts={LITE_SHORTCUTS} />
            <main style={{ flex: 1, minHeight: 0, position: "relative" }}>
                {status === "error" ? (
                    <Result status="error" title="Could not load the model" subTitle="Reload the page to try again." />
                ) : (
                    <>
                        <LiteGraph />
                        {status === "loading" && (
                            <Spin size="large" style={{ position: "absolute", inset: 0, margin: "auto", height: "fit-content" }} />
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

const LiteApp = () => (
    <ConfigProvider theme={{ token: { colorPrimary: "#333333" } }}>
        <AntApp style={{ height: "100%" }}>
            <GraphProvider defaultDarkMode={false}>
                <LiteContent />
            </GraphProvider>
        </AntApp>
    </ConfigProvider>
);

export default LiteApp;
