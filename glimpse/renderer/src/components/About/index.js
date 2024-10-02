import React from "react";
import ReactDom from "react-dom";
import "./About.css";
import { Dialog, DialogContent, Slide } from "@mui/material";

const Transition = React.forwardRef((props, ref) => {
   return <Slide direction="up" ref={ref} {...props} />;
});

const About = ({ show, close }) => {
   return ReactDom.createPortal(
      <>
         <Dialog
            sx={{ "& .MuiDialog-paper": { alignItems: "center" } }}
            fullScreen
            hideBackdrop={true}
            open={show}
            TransitionComponent={Transition}
         >
            <div className="about-banner">
               <button className="close-about-btn" onClick={close}>
                  Close
               </button>
            </div>
            <DialogContent sx={{ maxWidth: "72rem", padding: "0 2rem" }}>
               <div className="about-title">
                  <h1>GLIMPSE v0.4.0</h1>
                  <h3>(Grid Layout Interface for Model Preview and System Exploration)</h3>
               </div>
               <div className="description">
                  <p>
                     GLIMPSE is a graph-based web application to visualize and update GridLAB-D
                     power grid models. The tool can be used to search and highlight power grid
                     model objects. GLIMPSE also aims to support a variety of different network
                     representations and layouts.
                  </p>
               </div>
               <div className="features-list">
                  <h2>Features</h2>
                  <ul>
                     <li>
                        Before uploading JSON files use the custom theme by clicking on themes at
                        the on the top left menu items. The custom theme mode will allow you to also
                        supply a custom.theme.json file with your JSON upload. If not the tool will
                        still visualize your file.
                     </li>
                     <li>Each node or edge in the legend can be double clicked for highlighting</li>
                     <li>Navigate through each highlighted Node with the Prev and Next buttons</li>
                     <li>
                        Hovering over a node in the visualization will display a tooltip of that
                        node's attributes
                     </li>
                     <li>
                        The Auto layout switch will turn on vis.js' physics engine allowing for the
                        network to be manipulated by the pointer
                     </li>
                     <li>
                        Double clicking on a node in the visualization will show a edit node form
                        that will allow you to edit that nodes attributes
                     </li>
                     <li>
                        The Show Plot button will display a plot created from metrics gathered from
                        the power grid model (Will show a filler plot for now)
                     </li>
                     <li>
                        The Show Stats Button will display a couple of summary statistics on the
                        current visualization
                     </li>
                     <li>
                        If any changes were done to a node's attributes using the tool you may
                        download a copy of the uploaded files with changes. (Works on .glm file
                        uploads for now)
                     </li>
                     <li>
                        Right clicking on an empty space in the visualization will prompt you to add
                        a new node or save the current visualization as an image to your computer.
                     </li>
                     <li>
                        Right clicking on a node will allow you to delete that node while right
                        clicking on an edge will allow you to hide that edge or hide all edges of
                        that type.
                     </li>
                     <li>
                        Right clicking on the node or edge types in the legend will show a context
                        menu and by selecting the edit theme button a movable form will show. This
                        form contains options to change the nodes color, shape, size, and image if
                        selecting the circular image shape. You will also be able to change a edge
                        type's color and width.
                     </li>
                     <li>
                        Any style changes done can be saved and exported to a custom.theme.json file
                        by selecting export theme in the themes file menu at the top of the tool.
                        This file can then be re-uploaded with any GLIMPSE compatible file that
                        those themes apply to.
                     </li>
                     <li>
                        Uploading larger models and larger networks will be clustered in to
                        communities allowing for smoother visualization experience. Clicking on
                        these clustered nodes will release all nodes in that cluster for further
                        examination utilizing the tools highlighting, exploration, and modification
                        features.
                     </li>
                     <li>
                        To upload multiple models or related files simply use the overlay upload
                        button to upload additional models or even the same model. Right-clicking on
                        an empty space will now show the option to create a new edge which can be
                        used to create connections between multiple models being visualized.
                     </li>
                     <li>
                        {`Using GLIMPSE's local WebSocket API a key value pair such as {animation: true} can be supplied to an existing edge to show an animation of a small red circle following the edge's path.`}
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
      </>,
      document.getElementById("portal")
   );
};

export default About;
