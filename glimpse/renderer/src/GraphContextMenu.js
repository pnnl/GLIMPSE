import React, { useState, useEffect } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from '@mui/material/MenuItem';

const GraphContextMenu = ({onMount, hideEdge, hideEdges, openNewNodeForm, deleteNode}) => {
    
   const [contextMenu, setContextMenu] = useState(null);

   useEffect(() => {
      onMount(contextMenu, setContextMenu);
   }, [contextMenu, setContextMenu]);
   
   if (contextMenu === null) return null;

   const handleHideEdge = () => {
      setContextMenu(null);
      hideEdge(contextMenu.edgeID);
   }

   const handleHideEdges = () => {
      setContextMenu(null);
      hideEdges(contextMenu.edgeID.split(":")[0]);
   }

   const handleClose = () => {
      setContextMenu(null);
   }

   const handleNewNode = () => {
      openNewNodeForm(true);
      setContextMenu(null);
   }

   const handleDeleteNode = () => {
      deleteNode(contextMenu.nodeID);
      setContextMenu(null);
   }

   const EdgeMenuItems = () => {
      return (
         <>
            <MenuItem onClick={handleHideEdge}>Hide Edge</MenuItem>
            <MenuItem onClick={handleHideEdges}>Hide Edges of This Type</MenuItem>
         </>
      );
   }

   return (
      <Menu sx={{zIndex: 999}}
         open = {contextMenu !== null}
         onClose={handleClose}
         anchorReference="anchorPosition"
         anchorPosition={
            contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : { top: 0, left: 0 }
         }>
         {  
            contextMenu.edgeID
            ? <EdgeMenuItems/>
            : contextMenu.nodeID 
            ? <MenuItem onClick={handleDeleteNode}>Delete Node</MenuItem>
            : <MenuItem onClick={handleNewNode}>New Node</MenuItem>
         }
      </Menu>
   );
}

export default GraphContextMenu;