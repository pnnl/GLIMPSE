import React from "react";
import ReactDOM from "react-dom";
import { useState, useEffect } from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, TextField, Stack } from "@mui/material";
import { CustomButton } from "../utils/CustomComponents";

const EditObjectModal = ({ onMount, onSave, close, isCim }) => {
   const [open, setOpen] = useState(false);
   const [selectedNode, setSelectedNode] = useState({});

   const { attributes } = selectedNode;

   // send the state back up to the Grpah(parent) component
   useEffect(() => {
      onMount(setSelectedNode, setOpen);
   }, [onMount, selectedNode]);

   const saveChanges = () => {
      onSave(selectedNode);
   };

   const handleChange = (e) => {
      const { name, value } = e.target;

      setSelectedNode({
         ...selectedNode,
         attributes: { ...selectedNode.attributes, [name]: value }
      });
   };

   return ReactDOM.createPortal(
      <Dialog
         sx={{ "& .MuiDialog-paper": { maxHeight: "35rem" } }}
         open={open}
         onClose={close}
         scroll="paper"
      >
         <DialogTitle>Edit Attributes</DialogTitle>
         <DialogContent dividers>
            <Stack direction="row" justifyContent="center" spacing={1} useFlexGap flexWrap="wrap">
               {attributes &&
                  Object.entries(attributes).map(([key, val], index) => (
                     <TextField
                        key={index}
                        label={key}
                        name={key}
                        defaultValue={val}
                        onChange={handleChange}
                     />
                  ))}
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

export default EditObjectModal;
