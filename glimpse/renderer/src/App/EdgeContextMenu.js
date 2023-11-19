import React, { useState, useEffect } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from '@mui/material/MenuItem';

const EdgeContextMenu = ({onMount, hideEdge, hideEdges}) => {
    
   const [contextMenu, setContextMenu] = useState(null);

   useEffect(() => {
      onMount(contextMenu, setContextMenu);
   }, [onMount, contextMenu])

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

   return (
      <Menu sx={{zIndex: 999}}
         open = {contextMenu !== null}
         onClose={handleClose}
         anchorReference="anchorPosition"
         anchorPosition={
            contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : null            
         }>
         <MenuItem onClick={handleHideEdge}>Hide Edge</MenuItem>
         <MenuItem onClick={handleHideEdges}>Hide Edges of This Type</MenuItem>
      </Menu>
   );
}

export default EdgeContextMenu;