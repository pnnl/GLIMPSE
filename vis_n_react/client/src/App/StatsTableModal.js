import React from 'react';
import ReactDom from "react-dom";
import { 
   Table, 
   TableBody,
   TableCell, 
   TableContainer, 
   TableHead, 
   TableRow, 
   Dialog
} from '@mui/material';

const StatsTableModal = ({show, close, data}) =>
{
   if(!show) return null;

   return ReactDom.createPortal(
      <>
         <Dialog open={show} onClose={close}>
            <TableContainer sx={{margin: "auto"}}>
               <Table sx={{minWidth: 650}} aria-label='Stats Table'>
                  <TableHead>
                     <TableRow>
                        {Object.entries(data).map(([key, val], index) => {
                           return ( <TableCell key={index}>{key}</TableCell> );
                        })}
                     </TableRow>
                  </TableHead>
                  <TableBody>
                     <TableRow key={"stats"} sx={{'&:last-child td, &:last-child th': {border: 0}}}>
                        {Object.entries(data).map(([key, val], index) => {
                           return ( <TableCell key={index}>{val}</TableCell> );
                        })}
                     </TableRow>
                  </TableBody>
               </Table>
            </TableContainer>
         </Dialog>
      </>,
      document.getElementById("portal")
   )
}

export default StatsTableModal;