import { useRef } from "react";
import "../styles/App.css";
import { Layout } from "antd";
import { Content } from "antd/es/layout/layout";
import AboutModal from "../components/modals/AboutModal";
import GraphLayout from "../content/GraphLayout";
import AppHeader from "./AppHeader";
import LoadModelModal from "../components/modals/LoadModelModal";
import { GraphProvider, useGraph } from "../contexts/GraphContext";
import ObjectStudio from "../components/object-studio/ObjectStudio";

const AppContent = ({ openAboutModalRef, openLoadModelModalRef }) => {
    const { view } = useGraph();

    return (
        <Layout style={{ backgroundColor: "#FFFFFF" }}>
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
                {view === "object-studio" && <ObjectStudio />}
            </Content>
        </Layout>
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
