import React, { useState } from 'react';
import '../styles/App.css';
import axios from 'axios';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';
import appConfig from '../appConfig/appConfig.json';

const appOptions = appConfig.appOptions;

const Home = () => {
   let content;
   const [dataToVisRequest, setDataToVisRequest] = useState({
      showFileUpload: true,
      data: null
   });
   
   const readJSONFile = async (file) => {

      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         
         reader.onload = (event) => {

            try 
            {
               const jsonData = JSON.parse(event.target.result);
               resolve(jsonData);
            } 
            catch (error) 
            {
               reject(error);
            }
         };
   
         reader.onerror = (error) => {
            reject(error);
         };
   
         reader.readAsText(file);
      });
   } 

   const fileUpload = async (files) => {

      if(files[0].name.split(".")[1] === "glm")
      {

         const formData = new FormData();
         for(let i = 0; i < files.length; i++)
         {
            formData.append('glmFile', files[i]);
         }
   
         const header = {
            "header": {
               "content-type": "multipart/form-data"
            }
         };
         
         await axios.post(appOptions.serverUrl + "/upload", formData, header).then((res) => {
   
            const data = res.data;
            
            if(data.alert)
            {
               alert(data.alert);
            }
            else
            {
               setDataToVisRequest({
                  showFileUpload: false,
                  data: data
               });
            }
         }).catch((error) => console.log(error.message))
      }
      else if (files[0].name.split(".")[1] === "json")
      {
         const jsonDataToVis = {};

         for(const file of files)
         {
            try
            {
               const jsonData = await readJSONFile(file);
               jsonDataToVis[file.name] = jsonData; 
            }
            catch(error)
            {
               console.error(`Error reading ${file.name}`, error)
            }
         }
         
         /**
            Send json data to backend to validate against a json schema.
            If the response is false then it will allert the user where their json
            data failed to be validated by the schema.
         */
         await axios.post(appOptions.serverUrl + "/validate", jsonDataToVis).then((res) => {
         
            if(res.data.isValid)
            {
               setDataToVisRequest({
                  showFileUpload: false,
                  data: jsonDataToVis
               });
            }
            else
            {
               alert(res.data.error);
            }
         });
      }
   }
   


   // Display the graph dashboard component if file uploads were succesfully validated
   if(!dataToVisRequest.showFileUpload)
   {
      content = <Graph visFiles = {dataToVisRequest.data} />;
   }
   else
   {
      content = <FileUpload fileUpload = {fileUpload} />;
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