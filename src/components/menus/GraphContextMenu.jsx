import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Menu } from "antd";
import { downloadAsImage } from "@sigma/export-image";
import graphHelper from "../../graph-helper/GraphHelper";
import NewObjectModal from "../modals/NewObjectModal";

const NODE_ITEMS = [
   { key: "edit-attributes", label: "Edit Attributes" },
   { type: "divider" },
   { key: "delete-node", label: "Delete Node" },
];
const EDGE_ITEMS = [
   { key: "edit-attributes", label: "Edit Attributes" },
   { key: "hide-edge", label: "Hide Edge", disabled: true },
   { key: "animate-edge", label: "Animate Edge", disabled: true },
   { type: "divider" },
   { key: "delete-edge", label: "Delete Edge" },
];
const GRAPH_ITEMS = [
   { key: "new-node", label: "Add New Node", disabled: false },
   { key: "new-edge", label: "Add New Edge", disabled: true },
   { type: "divider" },
   { key: "save-image", label: "Save image as..." },
];

const ITEMS = {
   nodeItems: NODE_ITEMS,
   edgeItems: EDGE_ITEMS,
   graphItems: GRAPH_ITEMS,
};

const GraphContextMenu = ({ context, close, openAttributesModal, openNewNodeModal }) => {
   if (!context.open) return null;

   const deleteNode = (nodeID) => {
      console.log(`Deleting node with ID: ${nodeID}`);
      graphHelper.graph.dropNode(nodeID);
      graphHelper.sigmaInstance.refresh();
   };

   const deleteEdge = (edgeID) => {
      console.log(`Deleting edge with ID: ${edgeID}`);
      graphHelper.graph.dropEdge(edgeID);
      graphHelper.sigmaInstance.refresh();
   };

   const handleImageSave = () => {
      downloadAsImage(graphHelper.sigmaInstance, {
         backgroundColor: "#FFFFFF",
         fileName: "GLIMPSE_network_snapshot",
         format: "png",
         layers: ["edges", "nodes", "labels"],
      });
   };

   const handleMenuClick = ({ key }) => {
      console.log(`Clicked on menu item: ${key}`);

      switch (key) {
         case "edit-attributes":
            openAttributesModal();
            break;
         case "hide-edge":
            break;
         case "delete-node":
            deleteNode(context.node);
            break;
         case "delete-edge":
            deleteEdge(context.edge);
            break;
         case "animate-edge":
            break;
         case "new-node":
            openNewNodeModal();
            break;
         case "new-edge":
            break;
         case "save-image":
            handleImageSave();
            break;
         default:
      }

      close();
   };

   return ReactDOM.createPortal(
      <Menu
         style={{
            width: "9rem",
            position: "absolute",
            left: context.x,
            top: context.y,
            borderRadius: "0.4rem",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
            zIndex: 1000,
         }}
         onClick={handleMenuClick}
         items={ITEMS[context.contextItems]}
      />,
      document.getElementById("portal"),
   );
};

export default GraphContextMenu;
