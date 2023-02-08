import '../styles/App.css';
import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import GlmFileUpload from './GlmFileUpload';
import Graph from './Graph';


const Home = () => {
  let content;
  const [displayComponent, setDisplayComponent] = useState({"fileUpload": true});
  const [filesToVis, setFilesToVis] = useState({});

  const fileUpload = async (files) => {
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

    await axios.post("http://localhost:3500/upload", formData, header).then((res) => {

      console.log(res.data);
      setFilesToVis(res.data);
    });
    
    setDisplayComponent({"fileUpload": false});
  }
  
  if(displayComponent.fileUpload)
  {
    content = <GlmFileUpload fileUpload = {fileUpload} />;
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
