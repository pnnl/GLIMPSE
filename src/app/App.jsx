import { useEffect, useRef } from "react";
import "../styles/App.css";
import { App as AntApp, ConfigProvider, Layout, theme } from "antd";
import { Content } from "antd/es/layout/layout";
import AboutModal from "../components/modals/AboutModal";
import GraphLayout from "../components/content/GraphLayout";
import AppHeader from "./AppHeader";
import LoadModelModal from "../components/modals/LoadModelModal";
import { GraphProvider, useGraph } from "../contexts/GraphContext";
import ModelDataView from "../components/model-data-view/ModelDataView";
import AgentsView from "../components/agents/AgentsView";
import graphHelper from "../graph-helper/GraphHelper";
import { notify, registerNotifier } from "../utils/notify";

// Hands antd's context-aware message/modal instances to utils/notify so every
// caller — including non-React modules — gets feedback that follows the active
// light/dark theme. Renders nothing.
const NotificationBridge = () => {
    const staticApi = AntApp.useApp();

    useEffect(() => {
        registerNotifier(staticApi);
    }, [staticApi]);

    // graph-builder skips objects it cannot draw rather than failing the whole
    // load. It dispatches instead of notifying directly because utils/notify
    // imports GraphHelper, and calling back into it would close that cycle.
    useEffect(() => {
        const onSkipped = (e) => {
            const count = e.detail?.count ?? 0;
            if (count > 0) {
                notify.warning(
                    `${count} object${count === 1 ? "" : "s"} in this model could not be drawn ` +
                        "and were skipped. See the browser console for details.",
                );
            }
        };
        window.addEventListener("model-objects-skipped", onSkipped);
        return () => window.removeEventListener("model-objects-skipped", onSkipped);
    }, []);

    return null;
};

// Native "leave site?" prompt when the model has edits that only exist in
// memory. The browser shows its own generic wording; the string is required to
// trigger it but is not displayed by modern browsers.
const useUnsavedChangesGuard = () => {
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (!graphHelper.hasUnsavedChanges()) return;
            e.preventDefault();
            e.returnValue = "";
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);
};

const AppContent = ({ onAboutModalMount, openAboutModalRef, openLoadModelModalRef }) => {
    const { view, darkMode } = useGraph();

    useUnsavedChangesGuard();

    return (
        <ConfigProvider
            theme={{
                algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: "#333333",
                    controlItemBgActive: darkMode ? "rgba(69,171,72,0.2)" : "rgba(51,51,51,0.12)",
                    controlItemBgActiveHover: darkMode ? "rgba(69,171,72,0.28)" : "rgba(51,51,51,0.18)",
                },
                components: {
                    Upload: {
                        colorPrimary: "#45AB48",
                        colorPrimaryHover: "#45AB48",
                        colorPrimaryActive: "#45AB48",
                    },
                    Tabs: {
                        itemSelectedColor: darkMode ? "#ffffff" : "#333333",
                        inkBarColor: darkMode ? "#45AB48" : "#333333",
                        itemHoverColor: darkMode ? "#45AB48" : "#333333",
                    },
                    Menu: {
                        colorPrimary: darkMode ? "#45AB48" : "#333333",
                        itemSelectedColor: darkMode ? "#45AB48" : "#333333",
                        itemSelectedBg: darkMode ? "rgba(69,171,72,0.15)" : "rgba(51,51,51,0.12)",
                        itemHoverColor: darkMode ? "#45AB48" : "#333333",
                        itemHoverBg: darkMode ? "rgba(69,171,72,0.08)" : "rgba(51,51,51,0.05)",
                        itemActiveBg: darkMode ? "rgba(69,171,72,0.2)" : "rgba(51,51,51,0.12)",
                        controlItemBgActive: darkMode ? "rgba(69,171,72,0.2)" : "rgba(51,51,51,0.12)",
                        controlItemBgActiveHover: darkMode
                            ? "rgba(69,171,72,0.2)"
                            : "rgba(51,51,51,0.12)",
                    },
                    Dropdown: {
                        colorPrimary: darkMode ? "#45AB48" : "#333333",
                    },
                    Button: darkMode
                        ? {
                              colorPrimary: "#333333",
                              colorPrimaryHover: "#45AB48",
                              colorPrimaryActive: "#45AB48",
                              defaultBg: "#333333",
                              defaultColor: "#ffffff",
                              defaultBorderColor: "#333333",
                              defaultHoverBg: "#45AB48",
                              defaultHoverColor: "#ffffff",
                              defaultHoverBorderColor: "#45AB48",
                              defaultActiveBg: "#45AB48",
                              defaultActiveColor: "#ffffff",
                              defaultActiveBorderColor: "#45AB48",
                          }
                        : {
                              colorPrimary: "#333333",
                              colorPrimaryHover: "#45AB48",
                              colorPrimaryActive: "#45AB48",
                              defaultBg: "#ffffff",
                              defaultColor: "#333333",
                              defaultBorderColor: "#333333",
                              defaultHoverBg: "#333333",
                              defaultHoverColor: "#ffffff",
                              defaultHoverBorderColor: "#333333",
                              defaultActiveBg: "#333333",
                              defaultActiveColor: "#ffffff",
                              defaultActiveBorderColor: "#333333",
                          },
                },
            }}
        >
            <AntApp>
                <NotificationBridge />
                <Layout style={{ backgroundColor: darkMode ? "#141414" : "#FFFFFF" }}>
                    <AppHeader
                        onAboutClick={openAboutModalRef}
                        openModelLoader={openLoadModelModalRef}
                    />
                    <LoadModelModal
                        onMount={(setter) => {
                            openLoadModelModalRef.current = setter;
                        }}
                    />
                    <Content style={{ position: "relative" }}>
                        <div
                            style={
                                view === "graph"
                                    ? { width: "100%", height: "100%" }
                                    : {
                                          position: "absolute",
                                          inset: 0,
                                          visibility: "hidden",
                                          pointerEvents: "none",
                                      }
                            }
                        >
                            <GraphLayout />
                        </div>
                        {view === "object-studio" && <ModelDataView />}
                        {view === "agents" && <AgentsView />}
                    </Content>
                </Layout>
                {/* Must stay inside ConfigProvider — a modal rendered outside it
                    gets antd's default (light) algorithm regardless of darkMode. */}
                <AboutModal onMount={onAboutModalMount} />
            </AntApp>
        </ConfigProvider>
    );
};

function App() {
    const openAboutModalRef = useRef(null);
    const openLoadModelModalRef = useRef(null);

    const handleAboutModalMount = (setter) => {
        openAboutModalRef.current = setter;
    };

    return (
        <GraphProvider>
            <AppContent
                onAboutModalMount={handleAboutModalMount}
                openAboutModalRef={openAboutModalRef}
                openLoadModelModalRef={openLoadModelModalRef}
            />
        </GraphProvider>
    );
}

export default App;
