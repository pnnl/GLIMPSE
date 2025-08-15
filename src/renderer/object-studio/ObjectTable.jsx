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

const ObjectTable = ({ tableData, objectColumns, nodes, setObjectToEdit, setTabValue }) => {
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

   const handleNameClick = (node) => {
      setObjectToEdit(node);
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
               const nodeId = obj.attributes[columnName];
               const node = tableData.nodes.get(nodeId);
               return (
                  <StyledTableCell align="right" key={i}>
                     <Link
                        component={"button"}
                        name={columnName}
                        value={nodeId}
                        variant="button"
                        onClick={() => handleNameClick(node)}
                     >
                        {node ? node.attributes?.name || nodeId : nodeId}
                     </Link>
                  </StyledTableCell>
               );
            }

            if (columnName === "name" && "name" in obj.attributes) {
               const objectName = obj.attributes.name;

               const object = nodes ? tableData.nodes.get(obj.id) : tableData.edges.get(obj.id);

               return (
                  <StyledTableCell align="right" key={i}>
                     <Link
                        component={"button"}
                        name={columnName}
                        value={objectName}
                        variant="button"
                        onClick={() => handleNameClick(object)}
                     >
                        {obj.attributes.name}
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
      <Paper sx={{ width: "100%", overflow: "hidden" }}>
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
