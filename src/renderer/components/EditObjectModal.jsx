import React from "react";
import ReactDOM from "react-dom";
import { useState, useEffect } from "react";
import {
   Dialog,
   DialogActions,
   DialogContent,
   DialogTitle,
   TextField,
   Stack,
   Link
} from "@mui/material";
import { CustomButton } from "../utils/CustomComponents";
import { ArrowLeft } from "@mui/icons-material";

const EditObjectModal = ({ onMount, onSave, close, isCim, graphData }) => {
   const [open, setOpen] = useState(false);
   const [prevEdgeID, setPrevEdgeID] = useState(null);
   const [selectedObj, setSelectedObj] = useState(null);

   const attributes = selectedObj ? selectedObj.attributes : null;
   const saveChanges = () => {
      onSave(selectedObj);
   };

   const handleChange = (e) => {
      const { name, value } = e.target;

      setSelectedObj({
         ...selectedObj,
         attributes: { ...selectedObj.attributes, [name]: value }
      });
   };

   // send the state back up to the Grpah(parent) component
   useEffect(() => {
      onMount(setSelectedObj, setOpen);
   }, [onMount, selectedObj]);

   return ReactDOM.createPortal(
      <Dialog
         sx={{ "& .MuiDialog-paper": { maxHeight: "35rem" } }}
         open={open}
         onClose={close}
         scroll="paper"
      >
         <DialogTitle>Edit {selectedObj ? selectedObj.attributes.name : "Attributes"}</DialogTitle>
         <DialogContent dividers>
            {prevEdgeID && (
               <CustomButton
                  sx={{ mb: "1rem" }}
                  startIcon={<ArrowLeft />}
                  onClick={() => {
                     setSelectedObj(graphData.edges.get(prevEdgeID));
                     setPrevEdgeID(null);
                  }}
               >
                  Back
               </CustomButton>
            )}
            <Stack
               sx={{ justifyContent: "space-evenly", flexWrap: "wrap" }}
               direction={"row"}
               spacing={1}
               useFlexGap
            >
               {attributes && "from" in attributes && (
                  <Stack
                     sx={{ width: "13.9rem", justifyContent: "space-evenly" }}
                     direction={"row"}
                     spacing={1}
                  >
                     {Object.entries(attributes).reduce((acc, [key, val]) => {
                        if (key === "to" || key === "from") {
                           acc.push(
                              <Link
                                 component={"button"}
                                 name={val}
                                 variant="button"
                                 key={key}
                                 onClick={(e) => {
                                    setPrevEdgeID(selectedObj.id);
                                    setSelectedObj(graphData.nodes.get(e.target.name));
                                 }}
                              >
                                 {key}:{" "}
                                 {graphData.nodes.get(val).attributes.name
                                    ? graphData.nodes.get(val).attributes.name
                                    : val}
                              </Link>
                           );
                        }
                        return acc;
                     }, [])}
                  </Stack>
               )}
               {attributes &&
                  Object.entries(attributes).map(([key, val], index) => {
                     if (key === "to" || key === "from") {
                        return null;
                     }

                     return (
                        <TextField
                           key={index}
                           label={key}
                           name={key}
                           value={val}
                           onChange={handleChange}
                        />
                     );
                  })}
            </Stack>
         </DialogContent>
         <DialogActions>
            <CustomButton onClick={saveChanges}>Save</CustomButton>
            <CustomButton
               onClick={() => {
                  setPrevEdgeID(null);
                  close();
               }}
            >
               Close
            </CustomButton>
         </DialogActions>
      </Dialog>,
      document.getElementById("portal")
   );
};

export default EditObjectModal;
