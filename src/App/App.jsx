import { useRef } from "react";
import "../styles/App.css";
import { Layout } from "antd";
import { Content } from "antd/es/layout/layout";
import AboutModal from "../components/modals/AboutModal";
import GraphLayout from "../content/GraphLayout";
import AppHeader from "./AppHeader";
import LoadModelModal from "../components/modals/LoadModelModal";
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
