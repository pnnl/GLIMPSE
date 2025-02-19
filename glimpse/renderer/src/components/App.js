import React, { useRef, useState } from "react";
import { handleFileUpload } from "../utils/appUtils";
import { LinearProgress, Box } from "@mui/material";
import FileUpload from "./FileUpload";
import Graph from "./Graph";
import Nav from "./Nav";

export const App = () => {
   const [fileData, setFileData] = useState({ loading: false });
   const [filesUploaded, setFilesUploaded] = useState(false);
   let applyOverlay = useRef(null);

   const showHome = () => {
      setFilesUploaded(false);
      setFileData({ loading: false });
   };

   return (
      <>
         <Nav showHome={showHome} modelNumber={fileData.modelNumber} applyOverlay={applyOverlay} />
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
            <Graph
               dataToVis={fileData.visData}
               theme={fileData.theme}
               isGlm={fileData.isGlm}
               modelNumber={fileData.modelNumber}
            />
         )}
      </>
   );
};
