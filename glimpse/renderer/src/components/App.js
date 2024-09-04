import React, { useState } from "react";
import { LinearProgress, Box } from "@mui/material";
import FileUpload from "./FileUpload";
import Graph from "./Graph";
import Nav from "./Nav";
import { handleFileUpload } from "../utils/appUtils";

export const App = () => {
   const [fileData, setFileData] = useState({ loading: false });
   const [filesUploaded, setFilesUploaded] = useState(false);

   const showHome = () => {
      setFilesUploaded(false);
      setFileData({ loading: false });
   };

   return (
      <>
         <Nav showHome={showHome} />
         {!filesUploaded && (
            <FileUpload
               onFileUpload={(paths) => handleFileUpload(paths, setFileData, setFilesUploaded)}
            />
         )}
         {fileData.loading && (
            <Box sx={{ width: "100%" }}>
               <LinearProgress />
            </Box>
         )}

         {filesUploaded && !fileData.loading && (
            <Graph dataToVis={fileData.visData} theme={fileData.theme} isGlm={fileData.isGlm} />
         )}
      </>
   );
};
