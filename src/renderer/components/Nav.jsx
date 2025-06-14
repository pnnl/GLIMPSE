import React, { useEffect, useState, useMemo, useRef } from "react";
import "../styles/Nav.css";
import About from "./About";
import { Stack, Toolbar, IconButton, Autocomplete, TextField } from "@mui/material";
import { SearchRounded } from "@mui/icons-material";

const Nav = ({ onMount, showHome, graphData, findNode, findEdge }) => {
   const [open, setOpen] = useState(false);
   const [showSearch, setShowSearch] = useState(false);
   const [searchValue, setSearchValue] = useState(null);
   // const [menuAnchorEl, setMenuAnchorEl] = useState(null);
   // const [themesSubMenuAnchorEl, setThemesSubMenuAnchorEl] = useState(null);
   // const [theme, setTheme] = useState("feeder-model-theme");
   // const parentMenuRef = useRef(null);
   // const openMenu = Boolean(menuAnchorEl);
   // const openThemeSubMenu = Boolean(themesSubMenuAnchorEl);

   const options = useMemo(() => {
      if (!showSearch || !graphData.current) {
         return [];
      }

      const sortedEdgeIDs = graphData.current.edges
         .get()
         .sort((a, b) => -b.type.localeCompare(a.type));
      const sortedNodeIDs = graphData.current.nodes
         .get()
         .sort((a, b) => -b.type.localeCompare(a.type));
      return [...sortedEdgeIDs, ...sortedNodeIDs];
   }, [showSearch, graphData.current]);

   const handleAboutBtn = (e) => {
      e.preventDefault();
      setOpen(true);
   };

   const handleSearch = () => {
      if (searchValue.elementType === "node") findNode.current(searchValue);
      else if (searchValue.elementType === "edge") findEdge.current(searchValue);
      else alert(`${searchValue.id} is not in the graph.`);
   };

   // const handleMenuClick = (e) => {
   //    setMenuAnchorEl(e.currentTarget);
   // };

   // const closeMenu = () => {
   //    setMenuAnchorEl(null);

   //    if (openThemeSubMenu) setThemesSubMenuAnchorEl(null);
   // };

   // const showThemesSubmenu = () => {
   //    setThemesSubMenuAnchorEl(parentMenuRef.current);
   // };

   // const closeThemesSubmenu = (e) => {
   //    const { value } = e.target;

   //    if (value === theme || value === undefined) {
   //       setThemesSubMenuAnchorEl(null);
   //    } else {
   //       setTheme(value);
   //       setThemesSubMenuAnchorEl(null);
   //    }
   // };

   useEffect(() => {
      onMount(setShowSearch);
   }, [setShowSearch, onMount]);

   return (
      <>
         <Toolbar variant="dense" sx={{ width: "100%" }}>
            {/* <IconButton disabled size="medium" onClick={handleMenuClick}>
               <MenuIcon />
            </IconButton>
            <Menu id="nav-menu" anchorEl={menuAnchorEl} open={openMenu} onClose={closeMenu}>
               <MenuItem>
                  <ListItemText>File</ListItemText>
                  <ListItemIcon sx={{ justifyContent: "flex-end" }}>
                     <ArrowRight />
                  </ListItemIcon>
               </MenuItem>
               <MenuItem
                  ref={parentMenuRef}
                  onMouseEnter={showThemesSubmenu}
                  onClick={showThemesSubmenu}
               >
                  <ListItemText>Themes</ListItemText>
                  <ListItemIcon sx={{ justifyContent: "flex-end" }}>
                     <ArrowRight />
                  </ListItemIcon>
               </MenuItem>
               <MenuItem>
                  <ListItemText>Graph View</ListItemText>
                  <ListItemIcon sx={{ justifyContent: "flex-end" }}>
                     <ArrowRight />
                  </ListItemIcon>
               </MenuItem>
               <MenuItem>
                  <ListItemText>Tools</ListItemText>
                  <ListItemIcon sx={{ justifyContent: "flex-end" }}>
                     <ArrowRight />
                  </ListItemIcon>
               </MenuItem>
            </Menu>
            <Menu
               id="themes-submenu"
               anchorEl={themesSubMenuAnchorEl}
               anchorOrigin={{
                  horizontal: "right",
                  vertical: "top"
               }}
               open={openThemeSubMenu}
               onClose={closeMenu}
            >
               <div onPointerLeave={closeThemesSubmenu}>
                  <RadioGroup
                     sx={{ padding: "0 16px" }}
                     value={theme}
                     onChange={closeThemesSubmenu}
                  >
                     <FormControlLabel
                        value="feeder-model-theme"
                        control={<Radio />}
                        label="Power Grid"
                     />
                     <FormControlLabel value="custom-theme" control={<Radio />} label="Custom" />
                  </RadioGroup>
                  <Divider />
                  <MenuItem>Export Theme</MenuItem>
               </div>
            </Menu> */}
            <img className="nav-logo" src="./imgs/GLIMPSE/GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
            {showSearch && (
               <Autocomplete
                  sx={{ margin: "0 auto", width: "50%" }}
                  size="small"
                  options={options}
                  groupBy={(option) => option.type}
                  getOptionLabel={(option) => option.id}
                  onChange={(event, option) => setSearchValue(option)}
                  renderInput={(params) => (
                     <Stack sx={{ m: 1 }} direction="row" spacing={1}>
                        <IconButton onClick={handleSearch}>
                           <SearchRounded />
                        </IconButton>
                        <TextField variant="outlined" {...params} label={"Search..."} />
                     </Stack>
                  )}
               />
            )}
            <Stack direction={"row"} spacing={1} sx={showSearch ? {} : { marginLeft: "auto" }}>
               <button className="header-btn" onClick={showHome}>
                  Home
               </button>
               <button className="header-btn" onClick={handleAboutBtn}>
                  About
               </button>
            </Stack>
         </Toolbar>

         <About show={open} close={() => setOpen(false)} />
      </>
   );
};

export default Nav;
