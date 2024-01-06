import React from "react";
import {
   Box
} from "@mui/material";

const MenuBar = () => {

   return (
      <Box sx={{
         "display": "flex",
         "justifyContent": "space-between",
         "alignItems": "center",
         "height": 30,
         "background": "#333",
         "-webkit-app-region": "drag"
      }}>

      </Box>
   );
}