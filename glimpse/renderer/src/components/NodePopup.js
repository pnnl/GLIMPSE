import React from "react";
import ReactDOM from "react-dom";
import { useState, useEffect } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Stack } from "@mui/material";
import { CustomButton } from "../utils/CustomComponents";

const NodePopup = ({ onMount, onSave, close }) => {
   const [open, setOpen] = useState(false);
   const [selectedNode, setSelectedNode] = useState({});

   // send the state back up to the Grpah(parent) component
   useEffect(() => {
      onMount(setSelectedNode, setOpen);
   }, [onMount, selectedNode]);

   const saveChanges = () => {
      onSave(selectedNode);
   };

   return ReactDOM.createPortal(
      <Dialog
         sx={{ "& .MuiDialog-paper": { maxHeight: "35rem" } }}
         open={open}
         onClose={close}
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
            <CustomButton onClick={saveChanges}>Save</CustomButton>
            <CustomButton onClick={close}>Close</CustomButton>
         </DialogActions>
      </Dialog>,
      document.getElementById("portal")
   );
};

export default NodePopup;
