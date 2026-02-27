import { useState, useEffect, useMemo } from "react";
import { Button, Flex, Dropdown, Select } from "antd";
import { GiHamburgerMenu } from "react-icons/gi";
import "../styles/AppHeader.css";
import graphHelper from "../graph-helper/GraphHelper";

import { useGraph } from "../contexts/GraphContext";

const AppHeader = ({ onAboutClick, openModelLoader }) => {
   const [graphLoaded, setGraphLoaded] = useState(false);
   const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
   const { graphUpdateTrigger } = useGraph;

   const menuItems = [
      { key: "export-model", label: "Export Model", disabled: true },
      { type: "divider" },
      { key: "graph-metrics", label: "Metrics", disabled: true },
      { type: "divider" },
      { key: "object-studio", label: "Object Studio", disabled: true },
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
   ];

   // Listen for graph load/clear events emitted by the Graph component
   useEffect(() => {
      const handleGraphLoaded = () => {
         setGraphLoaded(true);
      };

      const handleGraphCleared = () => setGraphLoaded(false);

      window.addEventListener("graph-loaded", handleGraphLoaded);
      window.addEventListener("graph-cleared", handleGraphCleared);

      return () => {
         window.removeEventListener("graph-loaded", handleGraphLoaded);
         window.removeEventListener("graph-cleared", handleGraphCleared);
      };
   }, []);

   const searchOptions = useMemo(() => {
      console.log("ran");
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
   }, [graphLoaded, graphUpdateTrigger]);

   const handleMenuClick = ({ key }) => {
      switch (key) {
         case "feeder-model-theme":
            setSelectedTheme(key);
            break;
         case "custom-theme":
            setSelectedTheme(key);
            break;
         case "export-model":
         case "graph-metrics":
         case "object-studio":
         case "export-theme":
      }
   };

   return (
      <div className="app-header">
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
         <img className="nav-logo" src="./GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
         {graphLoaded && (
            <Select
               style={{ width: "30rem", marginLeft: "auto" }}
               size="middle"
               showSearch
               options={searchOptions}
               placeholder="Search by ID"
               onSelect={(val) => graphHelper.focus(JSON.parse(val))}
            />
         )}
         <Flex style={{ marginLeft: "auto" }} gap={"0.5rem"}>
            <Button
               color="#333333"
               style={{ textTransform: "uppercase" }}
               onClick={() => openModelLoader.current(true)}
               size="middle"
               type="primary"
            >
               Load New
            </Button>
            <Button
               color="#333333"
               type="primary"
               size="middle"
               style={{ textTransform: "uppercase" }}
               onClick={() => onAboutClick.current(true)}
            >
               About
            </Button>
         </Flex>
      </div>
   );
};

export default AppHeader;
