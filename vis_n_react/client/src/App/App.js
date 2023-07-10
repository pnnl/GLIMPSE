import React, { useState } from 'react';
import '../styles/App.css';
import axios from 'axios';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';
import appConfig from '../appConfig/appConfig';

const appOptions = appConfig.appOptions;

const Home = () => {
  let content;
  const [showFileUpload, setShowFileUpload] = useState(true);
  const [filesToVis, setFilesToVis] = useState({});

  const fileUpload = (files) => {

    const formData = new FormData();
    for(let i = 0; i < files.length; i++)
    {
      formData.append('glmFile', files[i]);
    }
  
    var header = {
      header: {
        "content-type": "multipart/form-data"
      }
    };
    
    axios.post("http://localhost:3500/upload", formData, header).then((res) => {

      const data = res.data;
      
      if(data.alert)
      {
        alert(data.alert);
      }
      else
      {
        setFilesToVis(data);
        setShowFileUpload(false);
      }
      
    }).catch((error) => console.log(error.message))

  }

  if(showFileUpload)
  {
    content = <FileUpload fileUpload = {fileUpload} />;
  }
  else
  {
    content = <Graph visFiles = {filesToVis} />;
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