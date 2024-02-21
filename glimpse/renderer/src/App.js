import React, { useState } from 'react';
import './styles/App.css';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';
import appConfig from './config/appConfig.json';

const appOptions = appConfig.appOptions;

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
   let content = null;
   const [dataToVisRequest, setDataToVisRequest] = useState({
      showFileUpload: true,
      data: null
   });

   /**
    * This function will get the paths of the uploaded files and send them to the 
    * main process to then read the files, parse them, and evalute them.
    * @param {Array} paths - An array of paths from the uploaded files
    */
   const setFileData = async (paths, selectedTheme) => {
      let theme = null;
      //["Power Grid [default]", "Social", "Fishing", "Layout"]
      switch (selectedTheme) {
         case "Social":
            theme = require("./config/DefaultTheme.json");
            break;
         case "Fishing":
            theme = require("./config/FishingTheme.json");
            break;
         case "Layout": 
            theme = require("./config/LevelTheme.json");
            break;
         default:
            theme = require("./config/PowerGridTheme.json");
            break;
      }
      
      if (theme) {
         // validate the file if it is a json file
         if (paths[0].split(".")[1] === "json") {
            const validFileData = await window.glimpseAPI.validate(paths);
   
            if (Object.keys(validFileData).includes("error")) {
               alert(validFileData.error);
            }
            else {
               setDataToVisRequest({
                  showFileUpload: false,
                  data: JSON.parse(validFileData),
                  theme: theme
               });
            }
         }
         else {
            const data = await window.glimpseAPI.getJsonData(paths);
            if (data === undefined) {
               console.log("Something went wrong...");
            }
            else if (Object.keys(data).includes("alert")) {
               alert(data.alert);
            }
            else {
               setDataToVisRequest({
                  showFileUpload: false,
                  data: data,
                  theme: theme
               });   
            }
         }
      }
   }
   
   // Display the graph dashboard component if file uploads were succesfully validated
   if (!dataToVisRequest.showFileUpload) {
      content = <Graph dataToVis = {dataToVisRequest.data} theme={dataToVisRequest.theme} />;
   }
   else {
      content = <FileUpload setFileData = {setFileData} />;
   }
   
   return (
      <>
         <Nav />
         {content}
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