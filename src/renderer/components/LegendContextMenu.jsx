import React, { useState, useEffect } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

const LegendContextMenu = ({ openThemeBuilder, onMount, hideObjects }) => {
   const [contextMenu, setContextMenu] = useState(null);

   useEffect(() => {
      onMount(contextMenu, setContextMenu);
   }, [onMount, contextMenu]);

   const onHideObjects = () => {
      setContextMenu(null);

      hideObjects(contextMenu.object, contextMenu.type);
   };

   const handleClose = () => {
      setContextMenu(null);
   };

   const showThemeBuilder = () => {
      openThemeBuilder();
      setContextMenu(null);
   };

   return (
      <Menu
         sx={{ zIndex: 999 }}
         open={contextMenu !== null}
         onClose={handleClose}
         anchorReference="anchorPosition"
         anchorPosition={
            contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : null
         }
      >
         <MenuItem onClick={onHideObjects}>Hide All</MenuItem>
         <MenuItem onClick={showThemeBuilder}>Edit Theme</MenuItem>
      </Menu>
   );
};

export default LegendContextMenu;
