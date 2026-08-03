import { useState, useEffect, useMemo } from "react";
import { Button, Flex, Dropdown, Select, Switch } from "antd";
import { GiHamburgerMenu } from "react-icons/gi";
import MetricsModal from "../components/modals/MetricsModal";
import gridappsdLogo from "../../public/GridAPPS-D_Logo.webp";
import "../styles/AppHeader.css";

import graphHelper from "../graph-helper/GraphHelper";
import axios from "axios";

import { useGraph } from "../contexts/GraphContext";
import { API_BASE_URL } from "../config";
import Typography from "antd/es/typography/Typography";

const { Text } = Typography;

const AppHeader = ({ onAboutClick, openModelLoader }) => {
    const [graphLoaded, setGraphLoaded] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
    const [showMetrics, setShowMetrics] = useState(false);
    const [searchValue, setSearchValue] = useState(null);
    // Which tab of the load modal the current model came from. Only a model
    // pulled from the GridAPPS-D platform gets the co-branded header.
    const [isGridappsdModel, setIsGridappsdModel] = useState(false);
    const { graphUpdateTrigger, view, setView, darkMode, setDarkMode } = useGraph();

    const menuItems = [
        { key: "export-model", label: "Export Model", disabled: false },
        { type: "divider" },
        { key: "graph-metrics", label: "Metrics", disabled: false },
        { type: "divider" },
        { key: "object-studio", label: "Model Data View", disabled: false },
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

        window.addEventListener("graph-loaded", handleGraphLoaded);
        window.addEventListener("graph-cleared", handleGraphCleared);
        graphHelper.themeName = selectedTheme;

        return () => {
            window.removeEventListener("graph-loaded", handleGraphLoaded);
            window.removeEventListener("graph-cleared", handleGraphCleared);
        };
    }, [selectedTheme]);

    const searchOptions = useMemo(() => {
        if (!graphLoaded) return [];

        const edgeOptions = graphHelper.graph.mapEdges((id, attrs) => ({
            label: attrs.attributes.name ?? id,
            value: JSON.stringify({ id: id, type: "edge" }),
        }));
        const nodeOptions = graphHelper.graph.mapNodes((id, attrs) => ({
            label: attrs.attributes.name ?? id,
            value: JSON.stringify({ id: id, type: "node" }),
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
            console.warn("No data to export.");
            return;
        }

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
        } catch (error) {
            console.error("Export failed:", error);
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
            case "dark-mode":
                setDarkMode(!darkMode);
                break;
            case "export-theme":
        }
    };

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
                    <Button size="large" type="text" icon={<GiHamburgerMenu size="1.5rem" />} />
                </Dropdown>
                {isGridappsdModel && (
                    <>
                        <img className="nav-logo" src={gridappsdLogo} alt="GridAPPS-D LOGO" />
                        <Text italic>Powered by</Text>
                    </>
                )}
                <img className="nav-logo" src="./GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
                {graphLoaded && (
                    <Select
                        style={{ width: "24rem", marginLeft: "auto" }}
                        size="middle"
                        showSearch
                        value={searchValue}
                        options={searchOptions}
                        placeholder="Search by ID or Name"
                        onSelect={(val) => {
                            graphHelper.focus(JSON.parse(val));
                            setSearchValue(null);
                        }}
                        onChange={(val) => setSearchValue(val)}
                        filterOption={(input, option) =>
                            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                        }
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
        </>
    );
};

export default AppHeader;
