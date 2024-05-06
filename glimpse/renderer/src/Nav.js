import React, { useState } from 'react';
import "./styles/Nav.css";
import About from './About';
import {
   Box,
   Stack,
   AppBar,
   Button,
   Toolbar
} from "@mui/material"

const Nav = ({showHome}) => {
   const [open, setOpen] = useState(false);

   const handleAboutBtn = (e) => {
      e.preventDefault();
      setOpen(true);
   }

   return (
      <>
         <Box sx={{flexGrow: 1, height: "4rem"}}>
            <AppBar className="nav-header"
               sx={{
                  "display": "flex",
                  "boxShadow": "none",
                  "backgroundColor": "#333",
                  "color": "white",
                  "padding": "4px",
               }}
            >
            <Toolbar variant="dense" sx={{width: "100%"}}>
               <span className="title">GLIMPSE</span>
               <Stack direction={"row"} spacing={1} sx={{marginLeft: "auto"}}>
                  <button className="header-btn" onClick={showHome}>Home</button>
                  <button className="header-btn" onClick={handleAboutBtn}>About</button>
               </Stack>
            </Toolbar>
            </AppBar>
            <About show={open} close={() => setOpen(false)}/>
         </Box>
      </>
   )
}

export default Nav;