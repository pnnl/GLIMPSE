import React from "react";
import "../styles/FileUpload.css";
import { Card, CardActionArea, CardContent, Typography } from "@mui/material";

const FileUpload = ({ onFileUpload }) => {
   // triggers the input when the button is clicked

   const handleUplaod = async () => {
      const paths = await window.glimpseAPI.getFilePaths();
      console.log(paths);
      if (paths) onFileUpload(paths);
   };

   // Handle drag and drop
   const handleDrop = async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const paths = [];
      const files = e.dataTransfer.files;

      for (let file of files) {
         paths.push(await window.electron.webUtils.getPathForFile(file));
      }

      onFileUpload(paths);
   };

   const handleDragOver = (e) => {
      e.stopPropagation();
      e.preventDefault();
   };

   return (
      <div className="file-upload-form-container">
         <Card
            variant="outlined"
            sx={{
               border: "1px dashed #333333",
               height: "18rem",
               width: "36rem",
               borderRadius: "25px"
            }}
         >
            <CardActionArea
               sx={{ height: "100%" }}
               onClick={handleUplaod}
               onDragOver={handleDragOver}
               onDrop={handleDrop}
            >
               <CardContent
                  sx={{
                     height: "100%",
                     display: "flex",
                     flexDirection: "column",
                     alignItems: "center",
                     justifyContent: "center"
                  }}
               >
                  <Typography variant="h5">File Upload</Typography>
                  <Typography variant="body2">
                     Drag and drop files here or click to upload
                  </Typography>
                  <ul>
                     <li>GLM</li>
                     <li>XML {"(CIM)"}</li>
                     <li>
                        JSON
                        <ul style={{ paddingLeft: "1rem" }}>
                           <li>Networkx Node Link Data Dump</li>
                           <li>GLIMPSE Structure</li>
                        </ul>
                     </li>
                  </ul>
               </CardContent>
            </CardActionArea>
         </Card>
         {/* <Button
            sx={{
               padding: "1rem",
               height: "100%",
               width: "100%",
               borderColor: "#333333",
               color: "#333333",
               ":hover": { backgroundColor: "#F8FAFC" }
            }}
            variant="text"
            onClick={handleUplaod}
         >
            Drag and drop files anywhere or click anywhere to upload
         </Button> */}
      </div>
   );
};

export default FileUpload;
