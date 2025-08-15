import { styled } from "@mui/material/styles";

import { TableRow, tableCellClasses, TableCell } from "@mui/material";
export const StyledTableRow = styled(TableRow)(({ theme }) => ({
   "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover
   },
   // hide last border
   "&:last-child td, &:last-child th": {
      border: 0
   }
}));

export const StyledTableCell = styled(TableCell)(() => ({
   [`&.${tableCellClasses.head}`]: {
      backgroundColor: "#777777",
      color: "white",
      height: "3rem"
   },
   [`&.${tableCellClasses.body}`]: {
      fontSize: 14
   }
}));
