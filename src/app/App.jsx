import { useRef } from "react";
import "../styles/App.css";
import { ConfigProvider, Layout, theme } from "antd";
import { Content } from "antd/es/layout/layout";
import AboutModal from "../components/modals/AboutModal";
import GraphLayout from "../components/content/GraphLayout";
import AppHeader from "./AppHeader";
import LoadModelModal from "../components/modals/LoadModelModal";
import { GraphProvider, useGraph } from "../contexts/GraphContext";
import ModelDataView from "../components/model-data-view/ModelDataView";

const AppContent = ({ openAboutModalRef, openLoadModelModalRef }) => {
    const { view, darkMode } = useGraph();

    return (
        <ConfigProvider
            theme={{
                algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: "#333333",
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
            <Layout style={{ backgroundColor: darkMode ? "#141414" : "#FFFFFF" }}>
                <AppHeader onAboutClick={openAboutModalRef} openModelLoader={openLoadModelModalRef} />
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
                </Content>
            </Layout>
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
                openAboutModalRef={openAboutModalRef}
                openLoadModelModalRef={openLoadModelModalRef}
            />
            <AboutModal onMount={handleAboutModalMount} />
        </GraphProvider>
    );
}

export default App;
