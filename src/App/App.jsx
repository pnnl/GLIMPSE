import { useMemo, useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router";
import "../styles/App.css";
import { Button, Flex, Layout, Dropdown, Modal, Select } from "antd";
import { Content, Header } from "antd/es/layout/layout";
import FileUpload from "../content/FileUpload";
import AboutModal from "../Components/AboutModal";
import { GiHamburgerMenu } from "react-icons/gi";
import { ExclamationCircleFilled } from "@ant-design/icons";
import graphHelper from "../graphHelper/GraphHelper";
import GraphLayout from "../content/GraphLayout";

const { confirm } = Modal;

const menuItems = [
   {
      key: "export-model",
      label: "Export Model",
   },
   { type: "divider" },
   {
      key: "toggle-legend",
      label: "Toggle Legend",
   },
   { type: "divider" },
   {
      key: "add-overlay",
      label: "Add Overlay",
   },
   { type: "divider" },
   {
      key: "graph-metrics",
      label: "Metrics",
   },
   { type: "divider" },
   {
      key: "object-studio",
      label: "Object Studio",
   },
   { type: "divider" },
   {
      key: "themes",
      label: "Themes",
      children: [
         { key: "feeder-model-theme", label: "Feeder Model Theme" },
         { key: "custom-theme", label: "Custom" },
         { type: "divider" },
         { key: "export-theme", label: "Export Theme" },
      ],
   },
];

function App() {
   const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
   const [showSelectSearch, setShowSelectSearch] = useState(false);
   const navigate = useNavigate();
   const location = useLocation();
   let openAboutModal = null;

   // Listen for graph load/clear events emitted by the Graph component
   useEffect(() => {
      const handleGraphLoaded = () => setShowSelectSearch(true);
      const handleGraphCleared = () => setShowSelectSearch(false);

      window.addEventListener("graph-loaded", handleGraphLoaded);
      window.addEventListener("graph-cleared", handleGraphCleared);

      return () => {
         window.removeEventListener("graph-loaded", handleGraphLoaded);
         window.removeEventListener("graph-cleared", handleGraphCleared);
      };
   }, []);

   // Make sure search is hidden when navigating to Home
   useEffect(() => {
      if (location.pathname === "/") setShowSelectSearch(false);
   }, [location]);

   const searchOptions = useMemo(() => {
      if (!showSelectSearch) return [];

      const edgeOptions = graphHelper.graph.mapEdges((id, attributes) => ({
         label: attributes.name ?? id,
         value: JSON.stringify({ id: id, type: "edge" }),
      }));
      const nodeOptions = graphHelper.graph.mapNodes((id, attributes) => ({
         label: attributes.name ?? id,
         value: JSON.stringify({ id: id, type: "node" }),
      }));

      return [...nodeOptions, ...edgeOptions];
   }, [showSelectSearch]);

   const showConfirm = () => {
      if (location.pathname === "/") {
         return;
      }

      confirm({
         title: "Do you wish to upload a new model?",
         content: "You will lose current visualization and any changes do to object attributes...",
         icon: <ExclamationCircleFilled />,
         okType: "danger",
         okText: "Yes, upload new model",
         onOk: () => {
            navigate("/");
         },
      });
   };

   const handleMenuClick = ({ key }) => {
      console.log(key);
      switch (key) {
         case "feeder-model-theme":
            setSelectedTheme(key);
            break;
         case "custom-theme":
            setSelectedTheme(key);
            break;
         default:
            break;
      }
   };

   const handleMount = (aboutSetter) => {
      openAboutModal = aboutSetter;
   };

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
               <Dropdown
                  trigger={["click"]}
                  menu={{
                     items: menuItems,
                     selectedKeys: [selectedTheme],
                     onClick: handleMenuClick,
                  }}
               >
                  <Button size="large" type="text" icon={<GiHamburgerMenu size="1.5rem" />} />
               </Dropdown>
               <img className="nav-logo" src="./GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
               {showSelectSearch && (
                  <Select
                     style={{ width: "30rem", marginLeft: "auto" }}
                     size="middle"
                     showSearch
                     optionFilterProp="label"
                     options={searchOptions}
                     placeholder="Search by ID"
                     onSelect={(val) => graphHelper.focus(JSON.parse(val))}
                  />
               )}
               <Flex style={{ marginLeft: "auto" }} gap={"0.5rem"}>
                  <Button
                     style={{ textTransform: "uppercase" }}
                     onClick={() => showConfirm()}
                     size="middle"
                     type="primary"
                  >
                     Home
                  </Button>
                  <Button
                     type="primary"
                     size="middle"
                     style={{ textTransform: "uppercase" }}
                     onClick={() => openAboutModal(true)}
                  >
                     About
                  </Button>
               </Flex>
            </Header>

            <Content style={{ height: "calc(100vh - 4rem)", width: "100%", padding: "1px" }}>
               <Routes>
                  <Route path="/" element={<FileUpload />} />
                  <Route path="/graph" element={<GraphLayout />} />
               </Routes>
            </Content>
         </Layout>
         <AboutModal onMount={handleMount} />
      </>
   );
}

export default App;
