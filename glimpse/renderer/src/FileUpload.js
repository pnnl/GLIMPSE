import React from 'react';
import './styles/FileUpload.css';
import appCofig from "./config/appConfig.json";
import { useState, useRef } from 'react';
import { Button, ThemeProvider, createTheme, Stack, Divider} from '@mui/material';

const appOptions = appCofig.appOptions;

const FileUpload = ({ setFileData, setDataFromCim}) => {
   // drag state
   const [dragActive, setDragActive] = useState(false);
   // ref
   const inputRef = useRef(null);
    
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
   };

   // triggers when file is dropped
   const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) 
      {
         const paths = [];
         const files = e.dataTransfer.files;
         
         for (const file of files) {
            paths.push(file.path);
         }

         setFileData(paths);
      }
   };
    
   // triggers when file is selected with click
   const handleChange = async (e) => {
      e.preventDefault();
      // console.log(JSON.parse(await window.glimpseAPI.getJsonData()))

      if (e.target.files && e.target.files[0]) {
         const paths = [];
         const files = e.target.files;
         
         for (const file of files) {
            paths.push(file.path);
         }

         setFileData(paths)
      }
   };

   // triggers the input when the button is clicked
   const onButtonClick = () => {
      inputRef.current.click();
   };

   const useCim = async ( ) => {
      const data = await window.glimpseAPI.getCIM()
      setDataFromCim(data);
   }

   const theme = createTheme({
      palette: {
         primary: {
            main: "#333333"
         },
         secondary: {
            main: "#b25a00"
         }
      }
   });

   return (
      <div className='file-upload-form-container'>
      <ThemeProvider theme={theme}>
      <Stack
         direction="row"
         justifyContent="center"
         alignItems="center"
         divider={<Divider orientation="vertical" flexItem/>}
         spacing={1.5}
      >
         <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
               <input ref={inputRef} type="file" accept='.glm,.json' id="input-file-upload" multiple={true} onChange={handleChange} />
               <label id="label-file-upload" htmlFor="input-file-upload" className={dragActive ? "drag-active" : "" }>
               <div>
                  <p>Drag and drop your glm/JSON files here or</p>
                  <button className="upload-button" onClick={onButtonClick}>Upload files</button>
               </div> 
               </label>
               { dragActive && <div id="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
         </form>
         <Button
            size="large"
            variant="outlined"
            onClick={useCim}
            >
            {appOptions.buttons.useCimBtn}
          </Button>
      </Stack>
      </ThemeProvider>
      </div>
   );
};

export default FileUpload