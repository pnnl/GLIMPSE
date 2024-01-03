import React, { useState } from 'react';
import './styles/App.css';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';
import appConfig from './App/config/appConfig.json';

const appOptions = appConfig.appOptions;

const Home = () => {
   let content;
   const [dataToVisRequest, setDataToVisRequest] = useState({
      showFileUpload: true,
      data: null
   });
   
   const setFileData = async (paths) => {
      
      if(paths[0].split(".")[1] === "json") {
         const validFileData = await window.glimpseAPI.validate(paths);

         if (Object.keys(validFileData).includes("error")) {
            alert(validFileData.error);
         }
         else {
            setDataToVisRequest({
               showFileUpload: false,
               data: JSON.parse(validFileData)
            });
         }
      }
      else {
         const data = await window.glimpseAPI.getJsonData(paths);
         if (data === undefined) {
            console.log("Something went wrong...");
         }
         else if (Object.keys(data)[0] === "alert") {
            alert(data.alert);
         }
         else {
            setDataToVisRequest({
               showFileUpload: false,
               data: JSON.parse(data)
            });   
         }
      }
   }
   
   // Display the graph dashboard component if file uploads were succesfully validated
   if (!dataToVisRequest.showFileUpload) {
      content = <Graph dataToVis = {dataToVisRequest.data} />;
   }
   else {
      content = <FileUpload setFileData = {setFileData} />;
   }

   
   return (
      <>
         <header>
            <h1 className="title">{appOptions.title}</h1>
            <nav>
            <ul className="nav-links">
               <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>{appOptions.nav.home}</Link></li>
               <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>{appOptions.nav.about}</Link></li>
            </ul>
            </nav>
         </header>
         <main>{content}</main>
      </>
   );
}

export const About = () => {
   return (
      <div>
         <header>
         <h1 className="title">{appOptions.title}</h1>
         <nav>
            <ul className="nav-links">
               <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>{appOptions.nav.home}</Link></li>
               <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>{appOptions.nav.about}</Link></li>
            </ul>
         </nav>
         </header>
         <h1>About The tool</h1>
      </div>
   );
}

export const App = () => {
   return (
      <Home />
   );
}