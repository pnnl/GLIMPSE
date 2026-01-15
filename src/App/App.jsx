import { useMemo, useState, useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router";
import "../styles/App.css";
import { Layout } from "antd";
import { Content } from "antd/es/layout/layout";
import FileUpload from "../content/FileUpload";
import AboutModal from "../Components/AboutModal";
import graphHelper from "../graphHelper/GraphHelper";
import GraphLayout from "../content/GraphLayout";
import AppHeader from "../components/AppHeader";

function App() {
   const [graphLoaded, setGraphLoaded] = useState(false);
   const location = useLocation();
   const openAboutModal = useRef(null);

   // Listen for graph load/clear events emitted by the Graph component
   useEffect(() => {
      const handleGraphLoaded = () => setGraphLoaded(true);
      const handleGraphCleared = () => setGraphLoaded(false);

      window.addEventListener("graph-loaded", handleGraphLoaded);
      window.addEventListener("graph-cleared", handleGraphCleared);

      return () => {
         window.removeEventListener("graph-loaded", handleGraphLoaded);
         window.removeEventListener("graph-cleared", handleGraphCleared);
      };
   }, []);

   // Make sure search is hidden when navigating to Home
   useEffect(() => {
      if (location.pathname === "/") setGraphLoaded(false);
   }, [location]);

   const searchOptions = useMemo(() => {
      if (!graphLoaded) return [];

      const edgeOptions = graphHelper.graph.mapEdges((id, attributes) => ({
         label: attributes.name ?? id,
         value: JSON.stringify({ id: id, type: "edge" }),
      }));
      const nodeOptions = graphHelper.graph.mapNodes((id, attributes) => ({
         label: attributes.name ?? id,
         value: JSON.stringify({ id: id, type: "node" }),
      }));

      return [...nodeOptions, ...edgeOptions];
   }, [graphLoaded]);

   return (
      <>
         <Layout style={{ backgroundColor: "#FFFFFF" }}>
            <AppHeader
               graphLoaded={graphLoaded}
               searchOptions={searchOptions}
               onAboutClick={openAboutModal}
            />

            <Content>
               <Routes>
                  <Route path="/" element={<FileUpload />} />
                  <Route path="/graph" element={<GraphLayout />} />
               </Routes>
            </Content>
         </Layout>
         <AboutModal
            onMount={(setter) => {
               openAboutModal.current = setter;
            }}
         />
      </>
   );
}

export default App;
