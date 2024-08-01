import React, { useEffect } from "react";
import ReactDom from "react-dom";
import "../styles/OverlayUpload.css";
import { useState, useRef } from "react";
import { readJsonFile } from "../utils/fileProcessing";

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

   // triggers when file is dropped
   const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files[0]; // Get the selected file
      overlayFunc(await readJsonFile(file.path), setHideRemoveOverlayBtn);
      close();
   };

   // triggers when file is selected with click
   const handleChange = async (e) => {
      e.preventDefault();

      const file = e.target.files[0]; // Get the selected file
      overlayFunc(await readJsonFile(file.path), setHideRemoveOverlayBtn);
      close();
   };

   // triggers the input when the button is clicked
   const onButtonClick = () => {
      inputRef.current.click();
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
                     accept=".json"
                     id="input-file-upload"
                     multiple={false}
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
