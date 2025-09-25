import React from "react";
import PropTypes from "prop-types";
import {
   Dialog,
   FormControl,
   FormControlLabel,
   Checkbox,
   DialogContent,
   DialogActions,
   DialogTitle
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

   const handleChecked = (e, objectType) => {
      const { name, checked } = e.target;

      setLocalFilters((prev) => {
         const copy = { ...prev };
         copy[objectType] = { ...copy[objectType], [name]: checked };
         filteredAttributes[objectType] = copy[objectType];
         return copy;
      });
   };

   // Add this useEffect to handle the visualization update
   React.useEffect(() => {
      if (open) {
         showAttributes(true, graphData, filteredAttributes);
      }
   }, [localFilters, open, graphData, filteredAttributes]);

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
            {Object.entries(localFilters).map(([objectType, attributes], index) => (
               <CustomAccordion key={index}>
                  <CustomAccordionSummary>{objectType}</CustomAccordionSummary>
                  <CustomAccordionDetails>
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
                        {Object.entries(attributes).map(([attribute], index) => (
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
                                    checked={
                                       !!(
                                          localFilters &&
                                          localFilters[objectType] &&
                                          localFilters[objectType][attribute]
                                       )
                                    }
                                    name={attribute}
                                    size="small"
                                    onChange={(e) => handleChecked(e, objectType)}
                                 />
                              }
                           />
                        ))}
                     </FormControl>
                  </CustomAccordionDetails>
               </CustomAccordion>
            ))}
         </DialogContent>
         <DialogActions>
            <CustomButton onClick={() => setOpen(false)}>Close</CustomButton>
            {/* <CustomButton onClick={handleApply}>Apply</CustomButton> */}
         </DialogActions>
      </Dialog>
   );
};

export default FilterAttributesDialog;

FilterAttributesDialog.propTypes = {
   filteredAttributes: PropTypes.object,
   onToggleAttribute: PropTypes.func
};
