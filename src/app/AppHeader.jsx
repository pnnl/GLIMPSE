import { useState, useEffect } from "react";
import { Button, Flex, Dropdown, Switch, Tag, Tooltip, Typography } from "antd";
import { GiHamburgerMenu } from "react-icons/gi";
import ConnectionStatus from "../components/ConnectionStatus";
import ModelSearch from "../components/ModelSearch";
import MetricsModal from "../components/modals/MetricsModal";
import ShortcutsModal from "../components/modals/ShortcutsModal";
import "../styles/AppHeader.css";

import graphHelper from "../graph-helper/GraphHelper";
import axios from "axios";

import { useGraph } from "../contexts/GraphContext";
import { API_BASE_URL } from "../config";
import { notify, reportError } from "../utils/notify";
import { useShortcut } from "../hooks/useShortcut";

const { Text } = Typography;

const AppHeader = ({ onAboutClick, onLoadClick }) => {
    const [graphLoaded, setGraphLoaded] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
    const [showMetrics, setShowMetrics] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isGridappsdModel, setIsGridappsdModel] = useState(false);
    const { view, setView, darkMode, setDarkMode } = useGraph();
    const canExport = graphLoaded && !graphHelper.isCIM;

    const hasAgents = graphLoaded && graphHelper.agents.agents.length > 0;

    const menuItems = [
        {
            key: "export-model",
            label: (
                <Flex vertical gap={0}>
                    <span>Export Model</span>
                    {!canExport && (
                        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3 }}>
                            {!graphLoaded ? "Load a model first" : "GLM and JSON models only"}
                        </Text>
                    )}
                </Flex>
            ),
            disabled: !canExport,
        },
        { type: "divider" },
        { key: "graph-metrics", label: "Metrics", disabled: !graphLoaded },
        { type: "divider" },
        { key: "object-studio", label: "Model Data View", disabled: !graphLoaded },
        ...(hasAgents ? [{ type: "divider" }, { key: "agents", label: "Agents View" }] : []),
        { type: "divider" },
        { key: "shortcuts", label: "Keyboard Shortcuts" },
        { type: "divider" },
        {
            key: "themes",
            label: "Themes",
            children: [
                { key: "feeder-model-theme", label: "Feeder Model Theme" },
                { key: "custom-theme", label: "Custom" },
                { type: "divider" },
                { key: "export-theme", label: "Export Theme", disabled: true },
            ],
        },
        { type: "divider" },
        {
            key: "dark-mode",
            label: (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "2rem",
                    }}
                >
                    <span>Dark Mode</span>
                    <Switch size="small" checked={darkMode} />
                </div>
            ),
        },
    ];

    // Loading a model without a roster (any file upload) while the agents view
    // is open would leave the user on a permanently empty tab whose menu entry
    // has just disappeared.
    useEffect(() => {
        if (!hasAgents && view === "agents") setView("graph");
    }, [hasAgents, view, setView]);

    useEffect(() => {
        const handleGraphLoaded = (e) => {
            setGraphLoaded(true);
            setIsGridappsdModel(e?.detail?.source === "gridappsd");
        };

        const handleGraphCleared = () => {
            setGraphLoaded(false);
            setIsGridappsdModel(false);
        };

        const handleDirtyChange = (e) => setHasUnsavedChanges(Boolean(e?.detail?.dirty));

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);
        window.addEventListener("graph-dirty-change", handleDirtyChange);

        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
            window.removeEventListener("graph-dirty-change", handleDirtyChange);
        };
    }, []);

    const handleExport = async () => {
        const exportData = graphHelper.export();

        if (!exportData || Object.keys(exportData).length === 0) {
            notify.warning(
                "There is nothing to export — this model has no GLM source data to write back into.",
            );
            return;
        }

        setExporting(true);

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/export/glm`,
                { data: exportData },
                {
                    responseType: "blob",
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );

            const blob = new Blob([response.data], { type: "application/zip" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "exported_model.zip");
            document.body.appendChild(link);
            link.click();

            link.remove();
            window.URL.revokeObjectURL(url);

            // Edits are now on disk, so drop the unsaved-changes warning.
            graphHelper.clearDirty();
            notify.success("Model exported as exported_model.zip");
        } catch (error) {
            // An error response to a responseType:"blob" request arrives as a
            // Blob, so the JSON body has to be read back out before reporting.
            if (error.response?.data instanceof Blob) {
                try {
                    error.response.data = JSON.parse(await error.response.data.text());
                } catch {
                    // not JSON — reportError falls back to the axios message
                }
            }
            reportError("Export failed", error);
        } finally {
            setExporting(false);
        }
    };

    const handleMenuClick = ({ key }) => {
        switch (key) {
            case "feeder-model-theme":
            case "custom-theme":
                setSelectedTheme(key);
                graphHelper.themeName = key;
                break;
            case "export-model":
                handleExport();
                break;
            case "graph-metrics":
                setShowMetrics(true);
                break;
            case "object-studio":
                setView(view === "object-studio" ? "graph" : "object-studio");
                break;
            case "agents":
                setView(view === "agents" ? "graph" : "agents");
                break;
            case "shortcuts":
                setShowShortcuts(true);
                break;
            case "dark-mode":
                setDarkMode(!darkMode);
                break;
        }
    };

    useShortcut("d", () => setDarkMode((v) => !v));
    useShortcut("?", () => setShowShortcuts(true));

    return (
        <>
            <div className="app-header" style={{ backgroundColor: darkMode ? "#1f1f1f" : "#FFFFFF" }}>
                <Dropdown
                    trigger={["click"]}
                    menu={{
                        selectedKeys: [selectedTheme],
                        items: menuItems,
                        onClick: handleMenuClick,
                    }}
                >
                    <Button
                        size="large"
                        type="text"
                        aria-label="Main menu"
                        loading={exporting}
                        icon={<GiHamburgerMenu size="1.5rem" />}
                    />
                </Dropdown>
                {isGridappsdModel && (
                    <>
                        <img className="nav-logo" src="./GridAPPS-D_Logo.webp" alt="GridAPPS-D LOGO" />
                        <Text italic>Powered by</Text>
                    </>
                )}
                <img className="nav-logo" src="./GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
                {hasUnsavedChanges && (
                    <Tooltip title="This model has edits that only exist in the browser. Export it to keep them.">
                        <Tag color="warning" style={{ marginLeft: "1rem" }}>
                            Unsaved changes
                        </Tag>
                    </Tooltip>
                )}
                <span style={{ marginLeft: "0.75rem" }}>
                    <ConnectionStatus />
                </span>
                <ModelSearch style={{ marginLeft: "auto" }} />
                <Flex style={{ marginLeft: "auto" }} gap={"0.5rem"}>
                    <Button
                        style={{ textTransform: "uppercase" }}
                        onClick={onLoadClick}
                        size="middle"
                        type="primary"
                    >
                        Load
                    </Button>
                    <Button
                        type="primary"
                        size="middle"
                        style={{ textTransform: "uppercase" }}
                        onClick={onAboutClick}
                    >
                        About
                    </Button>
                </Flex>
            </div>
            <MetricsModal open={showMetrics} close={() => setShowMetrics(false)} />
            <ShortcutsModal open={showShortcuts} close={() => setShowShortcuts(false)} />
        </>
    );
};

export default AppHeader;
