import React from "react";
import "../styles/About.css";
import { Dialog, DialogContent, Slide } from "@mui/material";

const Transition = React.forwardRef((props, ref) => {
   return <Slide direction="up" ref={ref} {...props} />;
});

const About = ({ show, close }) => {
   return (
      <>
         <Dialog fullScreen maxWidth="xl" open={show} TransitionComponent={Transition}>
            <div className="about-banner">
               <button className="close-about-btn" onClick={close}>
                  Close
               </button>
            </div>
            <DialogContent sx={{ padding: "0rem 12rem" }}>
               <div className="about-title">
                  <h1>GLIMPSE v0.2.4</h1>
                  <h3>(Grid Layout Interface for Model Preview and System Exploration)</h3>
               </div>
               <div className="description">
                  <p>
                     GLIMPSE is a graph-based web application to visualize and update GridLAB-D power
                     grid models. The tool can be used to search and highlight power grid model objects.
                     GLIMPSE also aims to support a variety of different network representations and
                     layouts.
                  </p>
               </div>
               <div className="features-list">
                  <h2>Features</h2>
                  <ul>
                     <li>Each node or edge in the legend can be double clicked for highlighting</li>
                     <li>Navigate through each highlighted Node with the Prev and Next buttons</li>
                     <li>
                        Hovering over a node in the visualization will display a tooltip of that node's
                        attributes
                     </li>
                     <li>
                        The Auto layout switch will turn on vis.js' physics engine allowing for the
                        network to be manipulated by the pointer
                     </li>
                     <li>
                        Double clickin gon a node in the visualization will show a edit node form that
                        will allow you to edit that nodes attributes
                     </li>
                     <li>
                        The Show Plot button will display a plot created from metrics gathered from the
                        power grid model (Will show a filler plot for now)
                     </li>
                     <li>
                        The Show Stats Button will diplay a couple of summary statistics on the current
                        visualization
                     </li>
                     <li>
                        If any changes were done to a node's attributes using the tool you may download a
                        copy of the uploaded files with changes. (Works on .glm file uploads for now)
                     </li>
                     <li>
                        Right clicking on an empty space in the visualization will prompt you to add a
                        new node or save the current visualization as an image to your computer.
                     </li>
                     <li>
                        Right clicking on a node will allow you to delete that node while right clicking
                        on an edge will allow you to hide that edge or hide all edges of that type.
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
         </Dialog>
      </>
   );
};

export default About;
