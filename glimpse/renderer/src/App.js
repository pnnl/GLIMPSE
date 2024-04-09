import React, { useState } from 'react';
import './styles/App.css';
import { LinearProgress, Box } from "@mui/material"
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';

const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const Nav = () => {
   return (
      <header>
         <h1 className="title" ><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>{appOptions.title}</Link></h1>
         <nav>
            <ul className="nav-links">
               <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>{appOptions.nav.home}</Link></li>
               <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>{appOptions.nav.about}</Link></li>
            </ul>
         </nav>
      </header>
   )
}

export const Home = () => {

   let selectedTheme = null;
   let themeData = null;
   const [fileData, setFileData] = useState({loading: false});
   const [filesUploaded, setFilesUploaded] = useState(false);

   /**
    * This function will get the paths of the uploaded files and send them to the 
    * main process to then read the files, parse them, and evalute them.
    * @param {Array} paths - An array of paths from the uploaded files
    */
   const handleFileUpload = async (paths) => {
      setFileData({loading: true});
      selectedTheme = await window.glimpseAPI.getTheme();

      switch (selectedTheme) {
         case "social-theme":
            themeData = await window.glimpseAPI.getThemeJsonData("SocialTheme.json");
            break;
         case "fishing-theme":
            themeData = await window.glimpseAPI.getThemeJsonData("FishingTheme.json");
            break;
         case "layout-theme": 
            themeData = await window.glimpseAPI.getThemeJsonData("LevelTheme.json");
            break;
         default:
            themeData = await window.glimpseAPI.getThemeJsonData("PowerGridTheme.json");
            break;
      }

      if (paths[0].split(".")[1] === "json") {
         setFilesUploaded(true);
         const validFileData = JSON.parse(await window.glimpseAPI.validate(paths));
         
         if ("error" in validFileData) {
            alert(validFileData.error);
         }
         else {
            setFileData({
               visData: validFileData,
               theme: JSON.parse(themeData),
               isGlm: false,
               loading: false
            });
         }
      }
      else if (paths[0].split(".")[1] === "glm" && selectedTheme === "power-grid-theme") {
         setFilesUploaded(true);
         const data = await window.glimpseAPI.glm2json(paths);
         if (!data) {
            console.log("Something went wrong...");
         }
         else if (Object.keys(data).includes("alert")) {
            alert(data.alert);
         }
         else {
            setFileData({
               visData: data,
               theme: JSON.parse(themeData),
               isGlm: true,
               loading: false
            }); 
         }
      }
      else {
         alert("All <.glm> File Types Must Be Uploaded With The Power Grid Theme Selected !");
      }
   }
     
   return (
      <>
         <Nav />
         {!filesUploaded && <FileUpload onFileUpload={handleFileUpload} />}
         {fileData.loading && <Box sx={{width: "100%"}}><LinearProgress /></Box>}
         {filesUploaded && !fileData.loading && 
            <Graph 
               dataToVis = {fileData.visData} 
               theme={fileData.theme} 
               isGlm={fileData.isGlm} 
            />
         }
      </>
   );
}

export const About = () => {
   return (
      <>
         <Nav />
         <h1>About The tool</h1>
      </>
   );
}