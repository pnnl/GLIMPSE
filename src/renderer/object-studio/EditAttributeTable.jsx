import React from "react";
import PropTypes from "prop-types";
import {
   Table,
   TableBody,
   TableContainer,
   TableCell,
   TableRow,
   TableHead,
   Paper,
   Typography,
   TextField,
   Button,
   Box
} from "@mui/material";
import { useState } from "react";
import { StyledTableRow } from "./StyledComponents";

const EditAttributeTable = ({ object, onSave }) => {
   if (!object || !object.attributes) return null;

   const { attributes } = object;
   const { name, ...restAttributes } = attributes;
   const [editedAttributes, setEditedAttributes] = useState(restAttributes);

   const handleChange = (event) => {
      const { name, value } = event.target;
      setEditedAttributes((prev) => ({
         ...prev,
         [name]: value
      }));
   };

   const handleSave = () => {
      if (onSave) {
         onSave({ ...object, attributes: { ...object.attributes, ...editedAttributes } });
      }
   };

   return (
      <TableContainer component={Paper} sx={{ overflow: "auto", maxHeight: "calc(100% - 48px)" }}>
         <Typography
            variant="h6"
            align="center"
            sx={{ padding: "1rem 1rem", backgroundColor: "#777777", color: "#FFFFFF" }}
         >
            {name}
         </Typography>
         <Table>
            <TableHead>
               <TableRow>
                  <TableCell>Attribute</TableCell>
                  <TableCell>Value</TableCell>
               </TableRow>
            </TableHead>
            <TableBody>
               {Object.entries(editedAttributes).map(([key, value]) => (
                  <StyledTableRow key={key}>
                     <TableCell>{key}</TableCell>
                     <TableCell>
                        <TextField
                           value={value}
                           name={key}
                           onChange={handleChange}
                           variant="outlined"
                           size="small"
                        />
                     </TableCell>
                  </StyledTableRow>
               ))}
            </TableBody>
         </Table>
         <Box display="flex" justifyContent="flex-end" sx={{ p: 2 }}>
            <Button variant="contained" color="primary" onClick={handleSave}>
               Save
            </Button>
         </Box>
      </TableContainer>
   );
};

EditAttributeTable.propTypes = {
   object: PropTypes.shape({
      attributes: PropTypes.object.isRequired
   }).isRequired,
   onSave: PropTypes.func
};

export default EditAttributeTable;
