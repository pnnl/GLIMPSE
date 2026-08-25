import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button, Flex, Dropdown, Select, Switch, Tag, Tooltip } from "antd";
import { GiHamburgerMenu } from "react-icons/gi";
import MetricsModal from "../components/modals/MetricsModal";
import ShortcutsModal from "../components/modals/ShortcutsModal";
import "../styles/AppHeader.css";

import graphHelper from "../graph-helper/GraphHelper";
import axios from "axios";

import { useGraph } from "../contexts/GraphContext";
import { API_BASE_URL } from "../config";
import { notify, reportError } from "../utils/notify";
import { useShortcut } from "../hooks/useShortcut";
import Typography from "antd/es/typography/Typography";

const { Text } = Typography;

const AppHeader = ({ onAboutClick, openModelLoader }) => {
    const [graphLoaded, setGraphLoaded] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
    const [showMetrics, setShowMetrics] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [searchValue, setSearchValue] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    // Which tab of the load modal the current model came from. Only a model
    // pulled from the GridAPPS-D platform gets the co-branded header.
    const [isGridappsdModel, setIsGridappsdModel] = useState(false);
    const { graphUpdateTrigger, view, setView, darkMode, setDarkMode } = useGraph();
    const searchRef = useRef(null);

    // Export writes back through the saved GLM file data, which only exists for
    // GLM/JSON uploads — a CIM or GridAPPS-D model has nothing to write into.
    const canExport = graphLoaded && !graphHelper.isCIM;

    const menuItems = [
        {
            key: "export-model",
            // The reason is rendered inline rather than in a Tooltip: a disabled
            // antd menu item doesn't reliably receive hover, so a tooltip on it
            // would never appear.
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
        { type: "divider" },
        { key: "agents", label: "Agents View", disabled: !graphLoaded },
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

    // Listen for graph load/clear events emitted by the Graph component
    useEffect(() => {
        const handleGraphLoaded = (e) => {
            setGraphLoaded(true);
            setSearchValue(null);
            setIsGridappsdModel(e?.detail?.source === "gridappsd");
        };

        const handleGraphCleared = () => {
            setGraphLoaded(false);
            setSearchValue(null);
            setIsGridappsdModel(false);
        };

        const handleDirtyChange = (e) => setHasUnsavedChanges(Boolean(e?.detail?.dirty));

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);
        window.addEventListener("graph-dirty-change", handleDirtyChange);
        graphHelper.themeName = selectedTheme;

        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
            window.removeEventListener("graph-dirty-change", handleDirtyChange);
        };
    }, [selectedTheme]);

    // One option per node + edge — 20k+ on the larger feeders. The graph key and
    // element type are kept as fields on the option (Select passes the whole
    // option to onSelect), which avoids a JSON.stringify/parse round trip per
    // entry every time the graph changes.
    const searchOptions = useMemo(() => {
        if (!graphLoaded) return [];

        const nodeOptions = graphHelper.graph.mapNodes((id, attrs) => ({
            value: `node:${id}`,
            label: attrs.attributes?.name ?? id,
            objectId: id,
            objectType: "node",
        }));
        const edgeOptions = graphHelper.graph.mapEdges((id, attrs) => ({
            value: `edge:${id}`,
            label: attrs.attributes?.name ?? id,
            objectId: id,
            objectType: "edge",
        }));

        return [...nodeOptions, ...edgeOptions];
        // graphUpdateTrigger is the app-wide invalidation counter for the
        // module-singleton graph (bumped by newGraphUpdate after mutations) —
        // it's intentionally a dep even though it isn't read in the callback.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graphLoaded, graphUpdateTrigger]);

    const handleExport = async () => {
        // Get updated graph data from GraphHelper
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

            // Create a download link and trigger it
            const blob = new Blob([response.data], { type: "application/zip" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "exported_model.zip");
            document.body.appendChild(link);
            link.click();

            // Cleanup
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
                setSelectedTheme(key);
                graphHelper.themeName = key;
                break;
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
            case "export-theme":
        }
    };

    const focusSearch = useCallback(() => searchRef.current?.focus(), []);

    useShortcut("/", focusSearch, { enabled: graphLoaded });
    useShortcut("d", () => setDarkMode((v) => !v));
    useShortcut("?", () => setShowShortcuts(true));
    // Allowed while typing so it also gets the user out of the search box.
    useShortcut("escape", () => searchRef.current?.blur(), { allowInInput: true });

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
                {graphLoaded && (
                    <Select
                        ref={searchRef}
                        style={{ width: "24rem", marginLeft: "auto" }}
                        size="middle"
                        showSearch={{
                            filterOption: (input, option) =>
                                (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
                        }}
                        aria-label="Search the model by object ID or name"
                        value={searchValue}
                        options={searchOptions}
                        placeholder="Search by ID or Name  ( / )"
                        onSelect={(_val, option) => {
                            graphHelper.focus({ id: option.objectId, type: option.objectType });
                            setSearchValue(null);
                        }}
                        onChange={(val) => setSearchValue(val)}
                    />
                )}
                <Flex style={{ marginLeft: "auto" }} gap={"0.5rem"}>
                    <Button
                        style={{ textTransform: "uppercase" }}
                        onClick={() => openModelLoader.current(true)}
                        size="middle"
                        type="primary"
                    >
                        Load
                    </Button>
                    <Button
                        type="primary"
                        size="middle"
                        style={{ textTransform: "uppercase" }}
                        onClick={() => onAboutClick.current(true)}
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
