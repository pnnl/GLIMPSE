import { useState } from "react";
import { Button, Flex, Dropdown, Modal, Select } from "antd";
import { GiHamburgerMenu } from "react-icons/gi";
import { ExclamationCircleFilled } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router";
import "../styles/AppHeader.css";
import graphHelper from "../graphHelper/GraphHelper";

const { confirm } = Modal;

const AppHeader = ({ graphLoaded, searchOptions, onAboutClick }) => {
   const [selectedTheme, setSelectedTheme] = useState("feeder-model-theme");
   const navigate = useNavigate();
   const location = useLocation();

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
            { key: "export-theme", label: "Export Theme" },
         ],
      },
   ];

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
            break;
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
               onClick={() => showConfirm()}
               size="middle"
               type="primary"
            >
               Home
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
