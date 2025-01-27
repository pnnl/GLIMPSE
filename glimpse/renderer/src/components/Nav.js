import React, { useState, useRef, useEffect } from "react";
import "../styles/Nav.css";
import About from "./About";
import {
   Stack,
   Toolbar,
   IconButton,
   Menu,
   MenuItem,
   ListItemIcon,
   ListItemText,
   FormControl,
   FormLabel,
   RadioGroup,
   FormControlLabel,
   Radio,
   Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { ArrowRight } from "@mui/icons-material";
import NatigConfigModal from "./NatigConfigModal";

const Nav = ({ showHome, modelNumber, applyOverlay }) => {
   const [openAbout, setOpenAbout] = useState(false);
   const [menuAnchorEl, setMenuAnchorEl] = useState(null);
   const [themesSubMenuAnchorEl, setThemesSubMenuAnchorEl] = useState(null);
   const [theme, setTheme] = useState("feeder-model-theme");
   const parentMenuRef = useRef(null);
   const openMenu = Boolean(menuAnchorEl);
   const openThemeSubMenu = Boolean(themesSubMenuAnchorEl);
   let setOpenNatigConfigForm = null;

   const getNatigFormStateSetter = (natigFormStateSetter) => {
      setOpenNatigConfigForm = natigFormStateSetter;
   };

   const handleMenuClick = (e) => {
      setMenuAnchorEl(e.currentTarget);
   };

   const handleAboutBtn = (e) => {
      e.preventDefault();
      setOpenAbout(true);
   };

   const closeMenu = () => {
      setMenuAnchorEl(null);

      if (openThemeSubMenu) setThemesSubMenuAnchorEl(null);
   };

   const showThemesSubmenu = () => {
      setThemesSubMenuAnchorEl(parentMenuRef.current);
   };

   const closeThemesSubmenu = (e) => {
      const { value } = e.target;

      if (value === theme || value === undefined) {
         setThemesSubMenuAnchorEl(null);
      } else {
         setTheme(e.target.value);
         setThemesSubMenuAnchorEl(null);
      }
   };

   return (
      <>
         <Toolbar variant="dense" sx={{ width: "100%" }}>
            <IconButton size="medium" onClick={handleMenuClick}>
               <MenuIcon />
            </IconButton>
            <Menu id="nav-menu" anchorEl={menuAnchorEl} open={openMenu} onClose={closeMenu}>
               <MenuItem ref={parentMenuRef} onClick={showThemesSubmenu}>
                  <ListItemText>Themes</ListItemText>
                  <ListItemIcon
                     sx={{ justifyContent: "flex-end" }}
                     onPointerEnter={showThemesSubmenu}
                  >
                     <ArrowRight />
                  </ListItemIcon>
               </MenuItem>
               <MenuItem onClick={() => setOpenNatigConfigForm(true)}>
                  Scenario Configuration
               </MenuItem>
            </Menu>
            <Menu
               id="themes-submenu"
               anchorEl={themesSubMenuAnchorEl}
               anchorOrigin={{
                  horizontal: "right",
                  vertical: "top",
               }}
               open={openThemeSubMenu}
               onClose={closeMenu}
            >
               <MenuItem>Export Theme</MenuItem>
               <Divider />
               <FormControl sx={{ padding: "0 16px" }} onPointerLeave={closeThemesSubmenu}>
                  <FormLabel>Themes</FormLabel>
                  <RadioGroup value={theme} onChange={closeThemesSubmenu}>
                     <FormControlLabel
                        value="feeder-model-theme"
                        control={<Radio />}
                        label="Power Grid"
                     />
                     <FormControlLabel value="custom-theme" control={<Radio />} label="Custom" />
                  </RadioGroup>
               </FormControl>
            </Menu>
            <img
               className="nav-logo"
               src="./imgs/GLIMPSE/NSD_2294_BRAND_HAGEN-GLIMPSE_final_color.png"
               alt="GLIMPSE LOGO"
            />
            <Stack direction={"row"} spacing={1} sx={{ marginLeft: "auto" }}>
               <button className="header-btn" onClick={showHome}>
                  Home
               </button>
               <button className="header-btn" onClick={handleAboutBtn}>
                  About
               </button>
            </Stack>
         </Toolbar>

         <About show={openAbout} close={() => setOpenAbout(false)} />
         <NatigConfigModal
            onMount={getNatigFormStateSetter}
            modelNumber={modelNumber}
            applyOverlay={applyOverlay}
         />
      </>
   );
};

export default Nav;
