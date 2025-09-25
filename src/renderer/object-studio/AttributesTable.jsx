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
   Box,
   Link
} from "@mui/material";

function AttributesTable({
   attributes,
   setObject,
   onChange,
   save,
   readOnlyAttributesList,
   heading
}) {
   return (
      <TableContainer
         component={Paper}
         elevation={0}
         sx={{ maxWidth: "100%", maxHeight: "calc(100% - 96px)", overflow: "auto" }}
      >
         <Typography
            variant="h6"
            align="center"
            sx={{ padding: "1rem 1rem", backgroundColor: "#777777", color: "#FFFFFF" }}
         >
            {heading}
         </Typography>
         <Table>
            <TableHead>
               <TableRow>
                  <TableCell size="medium">Attribute</TableCell>
                  <TableCell size="medium">Value</TableCell>
               </TableRow>
            </TableHead>
            <TableBody>
               {attributes &&
                  Object.entries(attributes).map(([key, rawValue], index) => {
                     let value;
                     try {
                        value = JSON.parse(rawValue);
                     } catch {
                        value = rawValue;
                     }

                     // Check for empty array
                     if (Array.isArray(value) && value.length === 0) {
                        return (
                           <TableRow key={index}>
                              <TableCell>{key}</TableCell>
                              <TableCell>
                                 <Typography variant="body1" size="small">
                                    -
                                 </Typography>
                              </TableCell>
                           </TableRow>
                        );
                     } else if (Array.isArray(value) && value.length > 0) {
                        return (
                           <TableRow key={index}>
                              <TableCell>{key}</TableCell>
                              <TableCell>
                                 {value.map((obj, i) => (
                                    <>
                                       <Link
                                          component={"button"}
                                          key={i}
                                          value={obj["@id"]}
                                          variant="button"
                                          onClick={(e) => setObject(e.target.value)}
                                       >
                                          {obj["@id"]}
                                       </Link>
                                       <br />
                                    </>
                                 ))}
                              </TableCell>
                           </TableRow>
                        );
                     }

                     // Check for UUID (simple regex)
                     const uuidRegex =
                        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i;

                     if (typeof value === "string" && uuidRegex.test(value)) {
                        return (
                           <TableRow key={index}>
                              <TableCell>{key}</TableCell>
                              <TableCell>
                                 {readOnlyAttributesList.current.has(key) ? (
                                    <Typography>{value}</Typography>
                                 ) : (
                                    <Link
                                       component={"button"}
                                       value={value}
                                       variant="button"
                                       onClick={(e) => setObject(e.target.value)}
                                    >
                                       {value}
                                    </Link>
                                 )}
                              </TableCell>
                           </TableRow>
                        );
                     }

                     // Check for object
                     if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                        return (
                           <TableRow key={index}>
                              <TableCell>{key}</TableCell>
                              <TableCell title={JSON.stringify(value)}>
                                 <Typography
                                    sx={{
                                       maxWidth: "20rem",
                                       overflow: "hidden",
                                       textOverflow: "ellipsis"
                                    }}
                                    noWrap
                                    variant="body2"
                                    size="small"
                                 >
                                    {JSON.stringify(value)}
                                 </Typography>
                              </TableCell>
                           </TableRow>
                        );
                     }

                     return (
                        <TableRow key={index}>
                           <TableCell>{key}</TableCell>
                           <TableCell>
                              {readOnlyAttributesList.current.has(key) ? (
                                 <Typography>{value}</Typography>
                              ) : readOnlyAttributesList.current.has(key) ? (
                                 <Link
                                    component={"button"}
                                    variant="button"
                                    onClick={() => setObject({ type: "node", id: value })}
                                 >
                                    {value}
                                 </Link>
                              ) : (
                                 <TextField
                                    sx={{ maxHeight: "3rem" }}
                                    value={value}
                                    name={key}
                                    onChange={onChange}
                                    size="small"
                                 />
                              )}
                           </TableCell>
                        </TableRow>
                     );
                  })}
            </TableBody>
         </Table>
         {save && (
            <Box display="flex" justifyContent="flex-end" sx={{ p: 2 }}>
               <Button variant="contained" color="primary" onClick={save}>
                  Save
               </Button>
            </Box>
         )}
      </TableContainer>
   );
}

export default AttributesTable;
