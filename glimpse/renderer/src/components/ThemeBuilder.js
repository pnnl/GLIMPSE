import React, { useState } from "react";
import ReactDom from "react-dom";
import Draggable from "react-draggable";
import { Button, Card, CardActions, CardContent, CardHeader, TextField, MenuItem } from "@mui/material";

const ThemeBuilder = ({ close, open, nodeTypes }) => {
   const [color, setColor] = useState("#FFFFFF");
   const [objTypeValue, setObjTypeValue] = useState(nodeTypes[0]);

   // console.log(objTypeValue);

   if (!open) return null;

   return ReactDom.createPortal(
      <Draggable handle=".theme-builder-drag-handle" bounds=".gl-wrapper">
         <Card
            sx={{
               width: 300,
               height: 300,
               position: "absolute",
               top: "50%",
               left: "50%",
               zIndex: 99,
            }}
         >
            <CardHeader
               sx={{ ":hover": { cursor: "move" } }}
               className="theme-builder-drag-handle"
               title="Theme Builder"
            />
            <CardContent sx={{ m: 1, padding: 0, justifyContent: "space-between" }}>
               <TextField
                  select
                  size="medium"
                  fullWidth
                  name="nodeType"
                  label="Node Type"
                  variant="outlined"
                  value={objTypeValue}
                  onChange={(e) => {
                     setObjTypeValue(e.target.value);
                  }}
               >
                  {nodeTypes.map((type, index) => {
                     return (
                        <MenuItem key={index} value={type}>
                           {type}
                        </MenuItem>
                     );
                  })}
               </TextField>
               <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </CardContent>
            <CardActions
               sx={{ width: "100%", bottom: 0, position: "fixed", justifyContent: "flex-end" }}
            >
               <Button variant="outlined">Save</Button>
               <Button variant="outlined" onClick={close}>
                  Cancel
               </Button>
            </CardActions>
         </Card>
      </Draggable>,
      document.getElementById("portal")
   );
};

export default ThemeBuilder;
