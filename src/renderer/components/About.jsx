import React from 'react';
import ReactDom from 'react-dom';
import '../styles/About.css';
import { Dialog, DialogContent, Slide } from '@mui/material';

const About = ({ show, close }) => {
  return ReactDom.createPortal(
    <Dialog
      sx={{ '& .MuiDialog-paper': { alignItems: 'center' } }}
      fullScreen
      hideBackdrop={true}
      open={show}
    >
      <div className="about-banner">
        <button className="close-about-btn" onClick={close}>
          Close
        </button>
      </div>
      <DialogContent sx={{ maxWidth: '72rem', padding: '0 2rem' }}>
        <div className="about-title">
          <h1>GLIMPSE v0.4.4-capstone</h1>
          <h3>(Grid Layout Interface for Model Preview and System Exploration)</h3>
        </div>
        <div className="description">
          <p>
            GLIMPSE is a graph-based web application to visualize and update GridLAB-D power grid
            models. The tool can be used to search and highlight power grid model objects. GLIMPSE
            also aims to support a variety of different network representations and layouts.
          </p>
        </div>
        <div className="features-list">
          <h2>User Manual</h2>
          <ul>
            <li>
              You can find a GLIMPSE's User Manual{' '}
              <a href="https://github.com/pnnl/GLIMPSE/blob/master/Docs/User_Manual.pdf">here</a>{' '}
              for more information on how to use the tool.
            </li>
          </ul>
        </div>
        <div className="citation-wrapper">
          <h2>Please Cite As</h2>
          <pre>
            <code>
              {`@inproceedings{sanchez2024glimpse,
   title={GLIMPSE of Future Power Grid Models},
   author={Sanchez, Armando Mendoza and Purohit, Sumit},
   booktitle={2024 IEEE 18th International Conference on Semantic Computing (ICSC)},
   pages={224--225},
   year={2024},
   organization={IEEE}
}`}
            </code>
          </pre>
        </div>
      </DialogContent>
    </Dialog>,
    document.getElementById('portal')
  );
};

export default About;
