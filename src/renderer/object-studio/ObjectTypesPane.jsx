import React from "react";
import {
   Accordion,
   AccordionSummary,
   AccordionDetails,
   Typography,
   Chip,
   Divider
} from "@mui/material";
import { ExpandMore } from "@mui/icons-material";

function ObjectTypesPane({ objectTypes, setFilterTypes, filterTypes }) {
   if (!objectTypes) return null;
   /**
    *
    * @param {string} type Node or Edge
    * @param {string} objectType the type of node or edge type
    */
   const handleFilterChipClick = (type, objectType) => {
      if (filterTypes && type in filterTypes) {
         const newFilterTypes = { ...filterTypes };
         if (newFilterTypes[type].includes(objectType)) {
            newFilterTypes[type] = newFilterTypes[type].filter((t) => t !== objectType);

            if (newFilterTypes[type].length === 0) {
               delete newFilterTypes[type];
            }
         } else {
            newFilterTypes[type].push(objectType);
         }
         setFilterTypes(newFilterTypes);
      } else {
         setFilterTypes((prev) =>
            !prev ? { [type]: [objectType] } : { ...prev, [type]: [objectType] }
         );
      }
   };

   return (
      <>
         <Typography variant="h6" sx={{ textAlign: "center", padding: "12px 16px" }}>
            Object Types
         </Typography>

         <Divider />

         <Accordion defaultExpanded disableGutters elevation={0} square>
            <AccordionSummary expandIcon={<ExpandMore />}>Node Types</AccordionSummary>
            <AccordionDetails>
               {objectTypes.nodeTypes.map((ntype, index) => (
                  <Chip
                     sx={{
                        margin: "2px",
                        ":hover": { color: "#000000" },
                        ...(filterTypes &&
                           "nodes" in filterTypes &&
                           filterTypes.nodes.includes(ntype) && {
                              backgroundColor: "#333333",
                              color: "#ffffff",
                              ":hover": { backgroundColor: "#666666" }
                           })
                     }}
                     size="small"
                     label={ntype}
                     key={index}
                     onClick={() => handleFilterChipClick("nodes", ntype)}
                  />
               ))}
            </AccordionDetails>
         </Accordion>

         <Accordion defaultExpanded disableGutters elevation={0} square>
            <AccordionSummary expandIcon={<ExpandMore />}>Edge Types</AccordionSummary>
            <AccordionDetails>
               {objectTypes.edgeTypes.map((etype, index) => (
                  <Chip
                     sx={{
                        margin: "2px",
                        ...(filterTypes &&
                           "edges" in filterTypes &&
                           filterTypes.edges.includes(etype) && {
                              backgroundColor: "#333333",
                              color: "#ffffff",
                              ":hover": { backgroundColor: "#666666" }
                           })
                     }}
                     size="small"
                     label={etype}
                     key={index}
                     onClick={() => handleFilterChipClick("edges", etype)}
                  />
               ))}
            </AccordionDetails>
         </Accordion>
      </>
   );
}

export default ObjectTypesPane;
