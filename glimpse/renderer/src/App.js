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
   let selectedTheme = null;
   let themeData = null;
   const [dataToVisRequest, setDataToVisRequest] = useState({
      showFileUpload: true,
      data: null
   });

   /**
    * This function will get the paths of the uploaded files and send them to the 
    * main process to then read the files, parse them, and evalute them.
    * @param {Array} paths - An array of paths from the uploaded files
    */
   const setFileData = async (paths) => {
      selectedTheme = await window.glimpseAPI.getTheme();

      console.log(selectedTheme);

      switch (selectedTheme) {
         case "social-theme":
            themeData = await window.glimpseAPI.getJsonData("./renderer/src/config/DefaultTheme.json");
            break;
         case "fishing-theme":
            themeData = await window.glimpseAPI.getJsonData("./renderer/src/config/FishingTheme.json");
            break;
         case "layout-theme": 
            themeData = await window.glimpseAPI.getJsonData("./renderer/src/config/LevelTheme.json");
            break;
         default:
            themeData = await window.glimpseAPI.getJsonData("./renderer/src/config/PowerGridTheme.json");
            break;
      }

      themeData = JSON.parse(themeData);

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
               theme: themeData
            });
         }
      }
      else if (paths[0].split(".")[1] === "glm" && selectedTheme === "power-grid-theme") {
         const data = await window.glimpseAPI.glm2json(paths);
         if (!data) {
            console.log("Something went wrong...");
         }
         else if (Object.keys(data).includes("alert")) {
            alert(data.alert);
         }
         else {
            setDataToVisRequest({
               showFileUpload: false,
               data: data,
               theme: themeData
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
         {dataToVisRequest.showFileUpload
            ? <FileUpload setFileData = {setFileData} /> 
            : <Graph dataToVis = {dataToVisRequest.data} theme={dataToVisRequest.theme} />}
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