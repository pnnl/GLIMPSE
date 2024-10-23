import React, { useEffect } from "react";
import ReactDom from "react-dom";
import "../styles/OverlayUpload.css";
import { useState, useRef } from "react";

const OverlayUpload = ({ show, overlayFunc, close, setHideRemoveOverlayBtn }) => {
   if (!show) return null;

   const [dragActive, setDragActive] = useState(false);
   const inputRef = useRef(null);

   const handleEscKey = (e) => {
      if (e.key === "Escape") {
         close();
      }
   };

   useEffect(() => {
      window.addEventListener("keydown", handleEscKey);

      return () => window.removeEventListener("keydown", handleEscKey);
   }, []);

   const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.type === "dragenter" || e.type === "dragover") {
         setDragActive(true);
      } else if (e.type === "dragleave") {
         setDragActive(false);
      }
   };

   // triggers the input when the button is clicked
   const onButtonClick = () => {
      inputRef.current.click();
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
         overlayFunc(paths, setHideRemoveOverlayBtn);
      }

      close();
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
         overlayFunc(paths, setHideRemoveOverlayBtn);
      }
      close();
   };

   return ReactDom.createPortal(
      <div className="upload-modal">
         <div className="upload-overlay" onDoubleClick={close}>
            <div className="file-upload-form-container">
               <form
                  id="form-file-upload"
                  onDragEnter={handleDrag}
                  onSubmit={(e) => e.preventDefault()}
               >
                  <input
                     ref={inputRef}
                     type="file"
                     accept=".json,.glm,.xml"
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
                        <p>Drag and drop your json file here or</p>
                        <button className="upload-button" onClick={onButtonClick}>
                           Upload file
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
                     ></div>
                  )}
               </form>
            </div>
         </div>
      </div>,
      document.getElementById("portal")
   );
};

export default OverlayUpload;
