import React, { useEffect, useState} from "react";
import ReactDOM from "react-dom";
import {
   Dialog, 
   DialogTitle,
   DialogContent,
   DialogActions,
   Button,
   FormControl,
   MenuItem,
   TextField,
   Divider,
   Typography,
   Autocomplete,
   Stack,
} from "@mui/material";

const NewNodeForm = ({onMount, nodes, addNewNode}) => {
   const [openForm, setOpenForm] = useState(false);
   const [nodeTypeIndex, setNodeTypeIndex] = useState(0);
   const [edgeTypeIndex, setEdgeTypeIndex] = useState(0);

   // const [formObj, setFormObj] = useState({
   //    "o"
   // })

   const newNodeObj = {
      "objects": [
         {
            "name": "",
            "attributes": {
               "id": ""
            }
         },
         {
            "name":"",
            "attributes": {
               "id":"",
               "to": "",
               "from": ""
            }
         }
      ] 
   }
   
   console.log(newNodeObj);

   useEffect(() => {
      onMount(setOpenForm);
   }, [setOpenForm]);

   const handleClose = () => {
      setOpenForm(false);
   }

   const nodeTypes = [
      "node",
      "load", 
      "meter",
      "inverter_dyn",  
      "diesel_dg", 
      "capacitor", 
      "triplex_load",
      "triplex_node",
      "triplex_meter", 
      "substation", 
      "microgrid",
      "communication_node", 
   ];

   const edgeTypes = [
      "overhead_line",
      "switch",
      "underground_line",
      "series_reactor",
      "triplex_line",
      "regulator",
      "transformer",
      "mapping",
      "communication",
      "microgrid_connection",
      "parentChild",
      "line"
   ];

   const handleNodeTypeChange = (e) => {
      setNodeTypeIndex(e.target.value);
   }

   const handleEdgeTypeChange = (e) => {
      setEdgeTypeIndex(e.target.value);
   }

   const createNewNode = (e) => {
      e.preventDefault();

      addNewNode(newNodeObj);
      handleClose();
   }

   return ReactDOM.createPortal(
      <>
      <Dialog
      maxWidth="sm"
      fullWidth
      open={openForm}
      onClose={handleClose}
      scroll= "paper"
      >
         <DialogTitle id="new-node-title">New Node</DialogTitle>
         <DialogContent dividers>
         <FormControl fullWidth>
            <TextField
               select
               value={nodeTypeIndex}
               label="Node Type"
               variant="outlined"
               onChange={handleNodeTypeChange}
               >
               {
                  nodeTypes.map((type, index) => {
                     return (
                        <MenuItem key={index} value={index}>{type}</MenuItem>
                     );
                  })
               }
            </TextField>
            <TextField sx={{mt:2}} onChange={(e) => newNodeObj.objects[0].attributes.id = e.target.value} label="ID" variant="outlined"/>
         </FormControl>
         <Divider sx={{mt: 2}}/>
         <Typography variant="h6">Connections</Typography>
         <Stack 
            direction="row"
            spacing={2}
            >
            <FormControl fullWidth>
               <Autocomplete
                  options={nodes}
                  onChange={(e, value) => newNodeObj.objects[1].attributes.to = value}
                  renderInput={(params) => <TextField {...params} label="Connected To"/>}
               />
            </FormControl>
            <FormControl fullWidth>
               <TextField
               select
               value={edgeTypeIndex}
               label="Edge Type"
               variant="outlined"
               onChange={handleEdgeTypeChange}
               >
               {
                  edgeTypes.map((type, index) => {
                     return (
                        <MenuItem key={index} value={index}>{type}</MenuItem>
                     )
                  })
               }
               </TextField>
            </FormControl>
         </Stack>
         </DialogContent>
         <DialogActions>
            <Button onClick={createNewNode}>Create Node</Button>
            <Button onClick={handleClose}>Cancel</Button>
         </DialogActions>
      </Dialog>
      </>,
      document.getElementById("portal")
   );
}

export default NewNodeForm;