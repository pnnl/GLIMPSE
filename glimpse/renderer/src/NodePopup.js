import React from "react";
import ReactDOM from "react-dom";
import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";

const NodePopup = ({ onMount, onSave, onClose }) => {
   const [open, setOpen] = useState(false);
   const [selectedNode, setSelectedNode] = useState({});

   // send the state back up to the Grpah(parent) component
   useEffect(() => {
      onMount(setSelectedNode, setOpen);
   }, [onMount, selectedNode]);

   const saveChanges = () => {
      onSave(selectedNode);
   };

   const closePopup = () => {
      onClose();
   };

   return ReactDOM.createPortal(
      <Dialog
         sx={{ "& .MuiDialog-paper": { maxHeight: "35rem" } }}
         open={open}
         onClose={onClose}
         scroll="paper"
      >
         <DialogTitle id="scroll-dialog-title">Edit Node</DialogTitle>
         <DialogContent dividers>
            <Stack direction="row" justifyContent="center" spacing={1} useFlexGap flexWrap="wrap">
               {selectedNode.attributes &&
                  Object.entries(selectedNode.attributes).map(([key, val], index) => {
                     return (
                        <TextField
                           key={index}
                           label={key}
                           defaultValue={val}
                           onChange={(e) => {
                              setSelectedNode({
                                 ...selectedNode,
                                 attributes: { ...selectedNode.attributes, [key]: e.target.value },
                              });
                           }}
                        />
                     );
                  })}
            </Stack>
         </DialogContent>
         <DialogActions>
            <Button onClick={saveChanges}>Save</Button>
            <Button onClick={closePopup}>Close</Button>
         </DialogActions>
      </Dialog>,
      document.getElementById("portal")
   );
};

export default NodePopup;
