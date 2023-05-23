import '../styles/App.css';
import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import Graph from './Graph';


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
        <h1 className="title">Power Grid Model Visualization Tool</h1>
        <nav>
            <ul className="nav-links">
                <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
                <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
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
        <h1 className="title">Power Grid Model Visualization Tool</h1>
        <nav>
            <ul className="nav-links">
                <li><Link to ="/" style={{ textDecoration: 'none', color: "white" }}>Home</Link></li>
                <li><Link to="/About" style={{ textDecoration: 'none', color: "white"}}>About</Link></li>
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