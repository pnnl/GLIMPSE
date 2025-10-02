import React from "react";
import PropTypes from "prop-types";
import {
   Dialog,
   FormControl,
   FormControlLabel,
   Checkbox,
   DialogContent,
   DialogActions,
   DialogTitle,
   Typography,
   Box
} from "@mui/material";
import {
   CustomAccordion,
   CustomAccordionDetails,
   CustomAccordionSummary,
   CustomButton
} from "../utils/CustomComponents";
import { showAttributes } from "../utils/graphUtils";

const FilterAttributesDialog = ({ filteredAttributes, graphData }) => {
   const [open, setOpen] = React.useState(false);

   // Local copy of filteredAttributes so the dialog UI updates immediately when a
   // checkbox is toggled. Graph maintains the source-of-truth (non-react object),
   // but the dialog keeps a synced copy for rendering.
   const [localFilters, setLocalFilters] = React.useState(() =>
      filteredAttributes ? JSON.parse(JSON.stringify(filteredAttributes)) : {}
   );

   // When the dialog opens, re-sync the local copy from the passed filteredAttributes
   // (in case Graph mutated it outside React).
   React.useEffect(() => {
      if (open && filteredAttributes) {
         setLocalFilters(JSON.parse(JSON.stringify(filteredAttributes)));
      }
   }, [open, filteredAttributes]);

   const handleChecked = (e, objectType, elementType) => {
      const { name, checked } = e.target;

      setLocalFilters((prev) => {
         const newLocalFilters = { ...prev };
         // copy[objectType] = { ...copy[objectType], [name]: checked };
         newLocalFilters[elementType][objectType][name] = checked;
         filteredAttributes[elementType][objectType] = newLocalFilters[objectType];
         return newLocalFilters;
      });
   };

   // Add this useEffect to handle the visualization update
   const handleApply = () => {
      if (open) {
         showAttributes(true, graphData, localFilters);
      }
   };

   const handleSelectAll = (elementType, objectType, e) => {
      const { checked } = e.target;

      setLocalFilters((prev) => {
         const newLocalFilters = { ...prev };
         // create a new object where each attribute is set to checked
         const updatedAttributes = Object.keys(newLocalFilters[elementType][objectType]).reduce(
            (acc, attr) => {
               acc[attr] = checked;
               return acc;
            },
            {}
         );

         newLocalFilters[elementType][objectType] = updatedAttributes;
         filteredAttributes[elementType][objectType] = updatedAttributes;
         return newLocalFilters;
      });
   };

   React.useEffect(() => {
      const removeListenerArr = [];
      removeListenerArr.push(window.glimpseAPI.onFilterAttributes((show) => setOpen(show)));
      removeListenerArr.push(
         window.glimpseAPI.onShowAttributes((show) =>
            showAttributes(show, graphData, filteredAttributes)
         )
      );

      return () => removeListenerArr.forEach((remove) => remove());
   }, []);

   return (
      <Dialog
         sx={{ "& .MuiDialog-paper": { maxHeight: "35rem" } }}
         scroll="paper"
         open={open}
         onClose={() => setOpen(false)}
      >
         <DialogTitle>Filter Attributes</DialogTitle>
         <DialogContent dividers>
            {Object.entries(localFilters).map(([elementType, objectTypes], idx) => (
               <Box key={idx} sx={{ marginBottom: "1rem" }}>
                  <Typography variant="h4" gutterBottom>
                     {elementType}
                  </Typography>
                  {Object.entries(objectTypes).map(([objectType, attributes], index) => {
                     const allSelected = Object.values(attributes).every((v) => v === true);
                     const someSelected =
                        Object.values(attributes).some((v) => v === true) && !allSelected;

                     return (
                        <CustomAccordion key={index}>
                           <CustomAccordionSummary>{objectType}</CustomAccordionSummary>
                           <CustomAccordionDetails>
                              <FormControlLabel
                                 label="Select All"
                                 control={
                                    <Checkbox
                                       checked={allSelected}
                                       indeterminate={someSelected}
                                       onChange={(e) => handleSelectAll(elementType, objectType, e)}
                                    />
                                 }
                              />
                              <FormControl
                                 sx={{
                                    width: "100%",
                                    justifyContent: "space-between",
                                    flexDirection: "row",
                                    flexWrap: "wrap"
                                 }}
                                 component={"fieldset"}
                                 variant="standards"
                              >
                                 {Object.entries(attributes).map(([attribute, checked], index) => (
                                    <FormControlLabel
                                       sx={{
                                          width: "13rem",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis"
                                       }}
                                       title={attribute}
                                       key={index}
                                       label={attribute}
                                       control={
                                          <Checkbox
                                             checked={checked}
                                             name={attribute}
                                             size="small"
                                             onChange={(e) =>
                                                handleChecked(e, objectType, elementType)
                                             }
                                          />
                                       }
                                    />
                                 ))}
                              </FormControl>
                           </CustomAccordionDetails>
                        </CustomAccordion>
                     );
                  })}
               </Box>
            ))}
         </DialogContent>
         <DialogActions>
            <CustomButton onClick={() => setOpen(false)}>Close</CustomButton>
            <CustomButton onClick={handleApply}>Apply</CustomButton>
         </DialogActions>
      </Dialog>
   );
};

export default FilterAttributesDialog;

FilterAttributesDialog.propTypes = {
   filteredAttributes: PropTypes.object,
   onToggleAttribute: PropTypes.func
};
