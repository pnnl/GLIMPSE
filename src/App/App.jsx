import { useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router";
import "../styles/App.css";
import { Button, Flex, Layout } from "antd";
import { Content, Header } from "antd/es/layout/layout";
import FileUpload from "../content/FileUpload";
import GraphView from "../content/GraphView";
import AboutModal from "../Components/AboutModal";

function App() {
   const [openAbout, setOpenAbout] = useState(false);
   const navigate = useNavigate();

   return (
      <>
         <Layout style={{ backgroundColor: "#FFFFFF" }}>
            <Header
               style={{
                  height: "4rem",
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
               }}
            >
               <img className="nav-logo" src="./GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
               <Flex style={{ marginLeft: "auto" }} gap={"0.5rem"}>
                  <Button
                     style={{ textTransform: "uppercase" }}
                     onClick={() => navigate("/")}
                     size="middle"
                     type="primary"
                  >
                     Home
                  </Button>
                  <Button
                     type="primary"
                     size="middle"
                     style={{ textTransform: "uppercase" }}
                     onClick={() => setOpenAbout(true)}
                  >
                     About
                  </Button>
               </Flex>
            </Header>

            <Content style={{ height: "calc(100vh - 4rem)", width: "100%", padding: "1px" }}>
               <Routes>
                  <Route path="/" element={<FileUpload />} />
                  <Route path="/graph" element={<GraphView />} />
               </Routes>
            </Content>
         </Layout>
         <AboutModal open={openAbout} close={() => setOpenAbout(false)} />
      </>
   );
}

export default App;
