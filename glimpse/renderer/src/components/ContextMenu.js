import React, { useState, useEffect } from "react";
import { Menu, MenuItem } from "@mui/material";

const ContextMenu = ({
   onMount,
   hideEdge,
   hideEdges,
   openNewNodeForm,
   openNewEdgeForm,
   deleteNode,
   createCluster,
   animateEdge,
   deleteEdge,
}) => {
   const [contextMenu, setContextMenu] = useState(null);

   useEffect(() => {
      onMount(contextMenu, setContextMenu);
   }, [onMount, contextMenu]);

   if (!contextMenu) return null;

   const handleHideEdge = () => {
      hideEdge(contextMenu.edgeID);
      setContextMenu(null);
   };

   const handleHideEdges = () => {
      hideEdges(contextMenu.edgeID);
      setContextMenu(null);
   };

   const handleClose = () => {
      setContextMenu(null);
   };

   const handleNewNode = () => {
      openNewNodeForm(true);
      setContextMenu(null);
   };

   const handleDeleteEdge = () => {
      deleteEdge(contextMenu.edgeID);
      setContextMenu(null);
   };

   const handleNewEdge = () => {
      openNewEdgeForm(true);
      setContextMenu(null);
   };

   const handleAnimateEdge = () => {
      animateEdge(contextMenu.edgeID);
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

   const handleReCluster = () => {
      createCluster(contextMenu.CID);
      setContextMenu(null);
   };

   const EdgeMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleHideEdge}>Hide Edge</MenuItem>
            <MenuItem onClick={handleHideEdges}>Hide Edges of This Type</MenuItem>
            <MenuItem onClick={handleDeleteEdge}>Delete Edge</MenuItem>
            <MenuItem onClick={handleAnimateEdge}>Animate Edge</MenuItem>
         </>
      );
   };

   const ContextMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleNewNode}>New Node</MenuItem>
            <MenuItem onClick={handleNewEdge}>New Edge</MenuItem>
            <MenuItem onClick={handleSaveImage}>Save image as...</MenuItem>
         </>
      );
   };

   const NodeMenuItems = () => {
      return (
         <>
            <MenuItem key="delete-node" onClick={handleDeleteNode}>
               Delete Node
            </MenuItem>
            {"CID" in contextMenu && (
               <MenuItem key="cluster" onClick={handleReCluster}>
                  Cluster
               </MenuItem>
            )}
         </>
      );
   };

   return (
      <Menu
         sx={{ zIndex: 999 }}
         open={true}
         onClose={handleClose}
         anchorReference="anchorPosition"
         anchorPosition={
            contextMenu !== null
               ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
               : { top: 0, left: 0 }
         }
      >
         {"nodeID" in contextMenu ? (
            <NodeMenuItems />
         ) : "edgeID" in contextMenu ? (
            <EdgeMenuItems />
         ) : (
            <ContextMenuItems />
         )}
      </Menu>
   );
};

export default ContextMenu;
