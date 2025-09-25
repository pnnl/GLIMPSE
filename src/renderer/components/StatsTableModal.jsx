import React from "react";
import ReactDom from "react-dom";
import {
   Table,
   TableCell,
   TableContainer,
   TableRow,
   Dialog,
   Paper,
   TableHead,
   TableBody
} from "@mui/material";

const StatsTableModal = ({ show, close, data }) => {
   if (!show) return null;

   return ReactDom.createPortal(
      <>
         <Dialog open={show} onClose={close}>
            <TableContainer component={Paper}>
               <Table>
                  <TableHead>
                     <TableRow>
                        <TableCell sx={{ textDecoration: "bold" }}>Graph Metric</TableCell>
                        <TableCell sx={{ textDecoration: "bold" }}>Value</TableCell>
                     </TableRow>
                  </TableHead>
                  <TableBody>
                     {Object.entries(data).map(([key, val], index) => {
                        return (
                           <TableRow key={index}>
                              <TableCell align="left">{key}</TableCell>
                              <TableCell align="left">{val}</TableCell>
                           </TableRow>
                        );
                     })}
                  </TableBody>
               </Table>
            </TableContainer>
         </Dialog>
      </>,
      document.getElementById("portal")
   );
};

export default StatsTableModal;
