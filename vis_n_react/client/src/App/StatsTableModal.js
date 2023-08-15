import React from 'react';
import ReactDom from "react-dom";
import { 
   Table, 
   TableBody,
   TableCell, 
   TableContainer, 
   TableHead, 
   TableRow, 
   Paper
} from '@mui/material';

const StatsTableModal = ({show, close, data}) =>
{
   if(!show) return null;

   return ReactDom.createPortal(
      <>
         <div className='modal'>
         <div className='modal-overlay' onClick={close}>
         <div className='modal-content'>
            <TableContainer component={Paper} sx={{margin: "auto", zIndex: 999}}>
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
         </div>
         </div>
         </div>
      </>,
      document.getElementById("portal")
   )
}

export default StatsTableModal;