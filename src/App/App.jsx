import { useRef } from "react";
// import { Routes, Route } from "react-router";
import "../styles/App.css";
import { Layout } from "antd";
import { Content } from "antd/es/layout/layout";
// import FileUpload from "../components/FileUpload";
import AboutModal from "../components/AboutModal";
import GraphLayout from "../content/GraphLayout";
import AppHeader from "../components/AppHeader";
import LoadModelModal from "../components/LoadModelModal";
import { GraphProvider } from "../contexts/GraphContext";

function App() {
   const openAboutModalRef = useRef(null);
   const openLoadModelModalRef = useRef(null);

   const handleLoadModelModalMount = (setter) => {
      openLoadModelModalRef.current = setter;
   };

   const handleAboutModalMount = (setter) => {
      openAboutModalRef.current = setter;
   };

   return (
      <>
         <GraphProvider>
            <Layout style={{ backgroundColor: "#FFFFFF" }}>
               <AppHeader
                  onAboutClick={openAboutModalRef}
                  openModelLoader={openLoadModelModalRef}
               />
               <LoadModelModal onMount={handleLoadModelModalMount} />
               <Content>
                  <GraphLayout />
               </Content>
            </Layout>
            <AboutModal onMount={handleAboutModalMount} />
         </GraphProvider>
      </>
   );
}

export default App;
