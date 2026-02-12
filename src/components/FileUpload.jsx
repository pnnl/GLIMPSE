import React, { useRef, useState } from "react";
import "../styles/FileUpload.css";
import { Card, Progress } from "antd";
import axios from "axios";
import { useGraph } from "../contexts/GraphContext";
import graphHelper from "../graph-helper/GraphHelper";
// import { useNavigate } from "react-router";
const { Meta } = Card;

const cardStyles = {
   display: "flex",
   border: "1px dashed #333",
   height: "12rem",
   width: "20rem",
   margin: "2rem 0",
   borderRadius: "25px",
   justifyContent: "center",
   alignItems: "center",
};

const isGlmFile = (path) => path.split(".").pop() === "glm";
const isJsonFile = (path) => path.split(".").pop() === "json";
const isXmlFile = (path) => {
   const fileExtension = path.split(".").pop();
   return fileExtension === "xml" || fileExtension === "XML";
};

const validateFiles = (paths) => {
   if (paths.every(isGlmFile)) {
      return "api/upload/glm";
   } else if (paths.every(isXmlFile)) {
      return "api/upload/cim";
   } else if (paths.every(isJsonFile)) {
      return "api/upload/json";
   } else {
      alert(
         "Upload glm files with the Power Grid theme or any JSON file with the custom theme selected",
      );
   }
};

const FileUpload = ({ closeModal }) => {
   // const navigate = useNavigate();
   const { newGraphUpdate } = useGraph();
   const fileInputRef = useRef(null);
   const [dragActive, setDragActive] = useState(false);
   const [uploading, setUploading] = useState(false);
   const [progress, setProgress] = useState(0);

   const uploadFiles = async (fileList) => {
      if (!fileList || fileList.length === 0) return;
      const filenames = Array.from(fileList).map((file) => file.name);
      const formData = new FormData();
      const UPLOAD_URL = validateFiles(filenames);

      // append files; backend should accept `files` or adjust name accordingly
      Array.from(fileList).forEach((file) => {
         formData.append("files", file);
      });

      try {
         setUploading(true);
         setProgress(0);

         const res = await axios.post(`http://127.0.0.1:5051/${UPLOAD_URL}`, formData, {
            onUploadProgress: (progressEvent) => {
               if (!progressEvent.total) return;
               const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
               setProgress(percent);
            },
         });

         console.log(res.data);
         if ("error" in res.data) throw new Error(res.data.error);

         // Set graph data which triggers clear and render
         if (graphHelper.graph.order > 0) {
            graphHelper.clearGraphData();
            graphHelper.setGraphData(res.data);
            newGraphUpdate();
         } else {
            graphHelper.setGraphData(res.data);
            newGraphUpdate();
         }

         // Close modal after data is set
         closeModal();
      } catch (err) {
         console.error(err);
         setUploading(false);
         setProgress(0);
      } finally {
         setUploading(false);
         // reset progress after modal closes
         setTimeout(() => setProgress(0), 500);
      }
   };

   const handleFileUpload = (e) => {
      const files = e.target.files;
      uploadFiles(files);
      // reset input so same file can be selected again if needed
      e.target.value = null;
   };

   const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
   };

   const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
   };

   const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const files = e.dataTransfer.files;
      uploadFiles(files);
   };

   return (
      <div className="file-upload-container">
         <Card
            hoverable
            style={{ ...cardStyles, background: dragActive ? "#fafafa" : "inherit" }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
         >
            <input
               type="file"
               ref={fileInputRef}
               style={{ display: "none" }}
               multiple
               onChange={handleFileUpload}
            />
            <div style={{ width: "100%", textAlign: "center" }}>
               <Meta
                  title="File Upload"
                  description="Drag and Drop files here or click to upload"
               />
               {uploading && (
                  <div style={{ marginTop: 12 }}>
                     <Progress percent={progress} size="small" />
                  </div>
               )}
            </div>
         </Card>
      </div>
   );
};

export default FileUpload;
