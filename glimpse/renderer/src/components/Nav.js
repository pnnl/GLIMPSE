import React, { useState } from "react";
import "../styles/Nav.css";
import About from "./About";
import { Box, Stack, AppBar, Toolbar } from "@mui/material";

const Nav = ({ showHome }) => {
   const [open, setOpen] = useState(false);

   const handleAboutBtn = (e) => {
      e.preventDefault();
      setOpen(true);
   };

   return (
      <>
         <Toolbar variant="dense" sx={{ width: "100%" }}>
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

         <About show={open} close={() => setOpen(false)} />
      </>
   );
};

export default Nav;
