import React, { useState } from "react";
import { StyledTableCell, StyledTableRow } from "./StyledComponents";
import {
   TableContainer,
   TablePagination,
   TableBody,
   TableHead,
   Paper,
   Link,
   Table
} from "@mui/material";

const ObjectTable = ({
   tableData,
   unfilteredData,
   objectColumns,
   nodes,
   setObjectToEdit,
   setTabValue,
   isCIM
}) => {
   const [page, setPage] = useState(0);
   const [rowsPerPage, setRowsPerPage] = useState(25);

   const handleChangePage = (_, newPage) => {
      setPage(newPage);
   };

   const handleChangeRowsPerPage = (e) => {
      const { target } = e;
      setRowsPerPage(target.value);
      setPage(0);
   };

   const handleNameClick = (obj) => {
      if (isCIM) setObjectToEdit(obj.attributes.mRID);
      else setObjectToEdit({ type: obj.elementType, id: obj.attributes.name ?? obj.id });
      setTabValue(2);
   };

   const handleTableDataMap = (obj, index) => (
      <StyledTableRow key={index} hover>
         {objectColumns[nodes ? "nodeColumns" : "edgeColumns"].map((columnName, i) => {
            if (columnName === "type") {
               return (
                  <StyledTableCell align="right" key={i} sx={{ fontWeight: "bold" }}>
                     {obj.type}
                  </StyledTableCell>
               );
            }

            if (columnName === "from" || columnName === "to") {
               const node = unfilteredData.nodes.get(obj.attributes[columnName]);
               return (
                  <StyledTableCell align="right" key={i}>
                     <Link
                        component={"button"}
                        name={columnName}
                        value={node.id}
                        variant="button"
                        onClick={() => handleNameClick(node)}
                     >
                        {node.attributes.name ?? node.id}
                     </Link>
                  </StyledTableCell>
               );
            }

            if (columnName === "id" || (columnName === "name" && "name" in obj.attributes)) {
               const objectName = obj.attributes.name ?? obj.id;

               const object = nodes
                  ? unfilteredData.nodes.get(obj.id)
                  : unfilteredData.edges.get(obj.id);

               return (
                  <StyledTableCell align="right" key={i}>
                     <Link
                        component={"button"}
                        name={columnName}
                        value={objectName}
                        variant="button"
                        onClick={() => handleNameClick(object)}
                     >
                        {obj.attributes[columnName]}
                     </Link>
                  </StyledTableCell>
               );
            }

            return (
               <StyledTableCell align="right" key={i}>
                  {obj.attributes[columnName] ? obj.attributes[columnName] : "-"}
               </StyledTableCell>
            );
         })}
      </StyledTableRow>
   );

   if (!tableData) return null;

   return (
      <Paper elevation={0} sx={{ width: "100%", overflow: "hidden" }}>
         <TableContainer sx={{ height: "calc(100vh - 6.25rem)" }}>
            <Table size="small" stickyHeader>
               <TableHead>
                  <StyledTableRow>
                     {objectColumns[nodes ? "nodeColumns" : "edgeColumns"].map((column) => (
                        <StyledTableCell align="right" key={column} sx={{ fontWeight: "bold" }}>
                           {column}
                        </StyledTableCell>
                     ))}
                  </StyledTableRow>
               </TableHead>
               <TableBody>
                  {tableData[nodes ? "nodes" : "edges"]
                     .get()
                     .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                     .map(handleTableDataMap)}
               </TableBody>
            </Table>
         </TableContainer>
         <TablePagination
            rowsPerPageOptions={[25, 50, 100]}
            component="div"
            count={tableData[nodes ? "nodes" : "edges"].length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
         />
      </Paper>
   );
};

export default ObjectTable;
