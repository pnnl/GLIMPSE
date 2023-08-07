import React from 'react';
import ReactDom from 'react-dom';
import '../styles/OverlayUpload.css';
import { useState, useRef } from 'react';

const OverlayUpload = ({show, overlayFunc, close}) => {

   const [dragActive, setDragActive] = useState(false);
   const inputRef = useRef(null);

   if (!show) return null;
   
   const handleDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.type === "dragenter" || e.type === "dragover") 
      {
         setDragActive(true);
      } 
      else if (e.type === "dragleave") 
      {
         setDragActive(false);
      }
   }

   // triggers when file is dropped
   const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files[0]; // Get the selected file
      const filename = file.name;
      const reader = new FileReader(); // Create a FileReader object

      
      reader.onload = (e) => {
         const fileContents = e.target.result; // Read the file contents
         const jsonData = JSON.parse(fileContents); // Parse the JSON data
         overlayFunc({[filename]: jsonData});
      };

      reader.readAsText(file);
      close();
   }
   
   // triggers when file is selected with click
   const handleChange = (e) => {
      e.preventDefault();
      
      const file = e.target.files[0]; // Get the selected file
      const filename = file.name;
      const reader = new FileReader(); // Create a FileReader object

      reader.onload = (e) => {
         const fileContents = e.target.result; // Read the file contents
         const jsonData = JSON.parse(fileContents); // Parse the JSON data
         overlayFunc({[filename]: jsonData});
      };

      reader.readAsText(file);
      close();
   }

   // triggers the input when the button is clicked
   const onButtonClick = () => {
      inputRef.current.click();
   }

   return ReactDom.createPortal (
      <div className='upload-modal'>
      <div className='upload-overlay' onDoubleClick={close} >
      <div className='file-upload-form-container'>
         <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
               <input ref={inputRef} type="file" accept='.json' id="input-file-upload" multiple={true} onChange={handleChange} />
               <label id="label-file-upload" htmlFor="input-file-upload" className={dragActive ? "drag-active" : "" }>
               <div>
                  <p>Drag and drop your json file here or</p>
                  <button className="upload-button" onClick={onButtonClick}>Upload file</button>
               </div>
               </label>
               { dragActive && <div id="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
         </form>
      </div>
      </div>
      </div>,
      document.getElementById("portal")
   );
}

export default OverlayUpload;