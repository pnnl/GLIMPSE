import React from "react";
import "./FileUpload.css";
import { useState, useRef } from "react";

const FileUpload = ({ onFileUpload }) => {
   // drag state
   const [dragActive, setDragActive] = useState(false);
   // ref
   const inputRef = useRef(null);

   const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.type === "dragenter" || e.type === "dragover") {
         setDragActive(true);
      } else if (e.type === "dragleave") {
         setDragActive(false);
      }
   };

   // triggers when files are dropped
   const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
         const paths = [];
         const files = e.dataTransfer.files;

         for (const file of files) {
            paths.push(file.path);
         }
         e.target.value = "";
         onFileUpload(paths);
      }
   };

   // triggers when file are selected with click
   const handleChange = async (e) => {
      e.preventDefault();

      if (e.target.files && e.target.files[0]) {
         const paths = [];
         const files = e.target.files;

         for (const file of files) {
            paths.push(file.path);
         }
         e.target.value = "";
         onFileUpload(paths);
      }
   };

   // triggers the input when the button is clicked
   const onButtonClick = () => {
      inputRef.current.click();
   };

   return (
      <div className="file-upload-form-container">
         <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
            <input
               ref={inputRef}
               type="file"
               accept=".glm,.json"
               id="input-file-upload"
               multiple={true}
               onChange={handleChange}
            />
            <label
               id="label-file-upload"
               htmlFor="input-file-upload"
               className={dragActive ? "drag-active" : ""}
            >
               <div>
                  <p>
                     Drag and drop GLIMPSE supported file formats (e.g., JSON, GLM, NetworkX
                     [node-link data])
                  </p>
                  <button className="upload-button" onClick={onButtonClick}>
                     Or Click here to Upload file/s
                  </button>
               </div>
            </label>
            {dragActive && (
               <div
                  id="drag-file-element"
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
               />
            )}
         </form>
      </div>
   );
};

export default FileUpload;
