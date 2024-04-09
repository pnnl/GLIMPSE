import React from 'react';
import ReactDOM from "react-dom";
import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';

const NodePopup = ({onMount, onSave, onClose}) => {
   const [open, setOpen] = useState(false);
   const [selectedNode, setSelectedNode] = useState({});

   // send the state back up to the Grpah(parent) component
   useEffect(() => {
      onMount(setSelectedNode, setOpen);
   }, [onMount, selectedNode]);

   const saveChanges = () => {
      onSave(selectedNode);
   }

   const closePopup = () => {
      onClose();
   }

   return ReactDOM.createPortal(
      <Dialog
      open={open}
      onClose={onClose}
      scroll= "paper"
      >
         <DialogTitle id="scroll-dialog-title">Edit Node</DialogTitle>
         <DialogContent dividers>
         {selectedNode.attributes &&
            Object.entries(selectedNode.attributes).map(([key, val], index) => {
               return(
                  <TextField sx={{mt: 1, ml: 5.5}} key={index} label={key} defaultValue={val} onChange={(e) => { 
                     setSelectedNode({...selectedNode, attributes: {...selectedNode.attributes, [key]: e.target.value}}) 
                  }}/>
               );
            }) 
         }
         </DialogContent>
         <DialogActions>
            <Button onClick={saveChanges}>Save</Button>
            <Button onClick={closePopup}>Close</Button>
         </DialogActions>
      </Dialog>,
      document.getElementById("portal")
   );
}

export default NodePopup;