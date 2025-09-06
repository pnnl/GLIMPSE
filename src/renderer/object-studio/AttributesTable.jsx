import React from "react";
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

function AttributesTable({ name, attributes }) {
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
               {attributes &&
                  Object.entries(attributes).map(([key, value]) => (
                     <TableRow key={key}>
                        <TableCell>{key}</TableCell>
                        <TableCell>
                           <TextField value={value} name={key} variant="outlined" size="small" />
                        </TableCell>
                     </TableRow>
                  ))}
            </TableBody>
         </Table>
         <Box display="flex" justifyContent="flex-end" sx={{ p: 2 }}>
            <Button variant="contained" color="primary">
               Save
            </Button>
         </Box>
      </TableContainer>
   );
}

export default AttributesTable;
