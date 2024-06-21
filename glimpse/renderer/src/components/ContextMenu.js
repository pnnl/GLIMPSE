import React, { useState, useEffect } from "react";
import { Menu, MenuItem } from "@mui/material";

const ContextMenu = ({ onMount, hideEdge, hideEdges, openNewNodeForm, deleteNode }) => {
   const [contextMenu, setContextMenu] = useState(null);

   useEffect(() => {
      onMount(contextMenu, setContextMenu);
   }, [onMount, contextMenu]);

   const handleHideEdge = () => {
      hideEdge(contextMenu.edgeID);
      setContextMenu(null);
   };

   const handleHideEdges = () => {
      hideEdges(contextMenu.edgeID.split(":")[0]);
      setContextMenu(null);
   };

   const handleClose = () => {
      setContextMenu(null);
   };

   const handleNewNode = () => {
      openNewNodeForm(true);
      setContextMenu(null);
   };

   const handleDeleteNode = () => {
      deleteNode(contextMenu.nodeID);
      setContextMenu(null);
   };

   const handleSaveImage = () => {
      const networkCanvas = document.getElementById("graph").getElementsByTagName("canvas")[0];
      networkCanvas.toBlob(
         (blob) => {
            const imgLink = document.createElement("a");

            imgLink.href = URL.createObjectURL(blob);
            imgLink.download = "network-img";

            imgLink.click();
            imgLink.remove();
         },
         "image/png",
         1.0
      );
      // const canvasURL = networkCanvas.toDataURL("image/jpeg", 1.0);
      setContextMenu(null);
   };

   const EdgeMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleHideEdge}>Hide Edge</MenuItem>
            <MenuItem onClick={handleHideEdges}>Hide Edges of This Type</MenuItem>
         </>
      );
   };

   const ContextMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleNewNode}>New Node</MenuItem>
            <MenuItem onClick={handleSaveImage}>Save image as...</MenuItem>
         </>
      );
   };

   return (
      <Menu
         sx={{ zIndex: 999 }}
         open={contextMenu !== null}
         onClose={handleClose}
         anchorReference="anchorPosition"
         anchorPosition={
            contextMenu !== null
               ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
               : { top: 0, left: 0 }
         }
      >
         {contextMenu !== null && "nodeID" in contextMenu ? (
            <MenuItem onClick={handleDeleteNode}>Delete Node</MenuItem>
         ) : contextMenu !== null && "edgeID" in contextMenu ? (
            <EdgeMenuItems />
         ) : (
            <ContextMenuItems />
         )}
      </Menu>
   );
};

export default ContextMenu;
