import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Menu, MenuItem } from "@mui/material";

const ContextMenu = ({
   onMount,
   hideEdge,
   hideEdges,
   openNewNodeForm,
   openNewEdgeForm,
   deleteNode,
   createCluster,
   openCluster,
   animateEdge,
   removeAnimation,
   isEdgeAnimated,
   deleteEdge,
   graphData,
   openPopup,
   setObj
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

   const handleRemoveAnimation = () => {
      removeAnimation(contextMenu.edgeID);
      setContextMenu(null);
   };

   const handleDeleteNode = () => {
      deleteNode(contextMenu.nodeID);
      setContextMenu(null);
   };

   const handleEditNodeAttrbutes = () => {
      const selectedNode = graphData.nodes.get(contextMenu.nodeID);
      setObj(selectedNode);
      openPopup(true);
   };

   const handleEditEdgeAttributes = () => {
      const selectedEdge = graphData.edges.get(contextMenu.edgeID);
      setObj(selectedEdge);
      openPopup(true);
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

   const handleOpenCluster = () => {
      openCluster(contextMenu.clusterNodeID);
      setContextMenu(null);
   };

   const EdgeMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleEditEdgeAttributes}>Edit Attributes</MenuItem>
            <MenuItem onClick={handleHideEdge}>Hide Edge</MenuItem>
            <MenuItem onClick={handleHideEdges}>Hide Edges of This Type</MenuItem>
            <MenuItem onClick={handleDeleteEdge}>Delete Edge</MenuItem>
            {isEdgeAnimated(contextMenu.edgeID) ? (
               <MenuItem onClick={handleRemoveAnimation}>Remove Animation</MenuItem>
            ) : (
               <MenuItem onClick={handleAnimateEdge}>Animate Edge</MenuItem>
            )}
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
            <MenuItem onClick={handleEditNodeAttrbutes}>Edit Attributes</MenuItem>
            <MenuItem onClick={handleDeleteNode}>Delete Node</MenuItem>
            {"CID" in contextMenu && <MenuItem onClick={handleReCluster}>Cluster</MenuItem>}
            {"clusterNodeID" in contextMenu && (
               <MenuItem onClick={handleOpenCluster}>Open Cluster</MenuItem>
            )}
         </>
      );
   };

   return ReactDOM.createPortal(
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
         {"nodeID" in contextMenu || "clusterNodeID" in contextMenu ? (
            <NodeMenuItems />
         ) : "edgeID" in contextMenu ? (
            <EdgeMenuItems />
         ) : (
            <ContextMenuItems />
         )}
      </Menu>,
      document.getElementById("portal")
   );
};

export default ContextMenu;
