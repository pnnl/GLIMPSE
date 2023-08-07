import React, {  useEffect, useState } from 'react';
import "../styles/NodePopup.css";

function NodePopup({onMount, onSave, onClose}) {

   const [selectedNode, setSelectedNode] = useState({});

   useEffect(() => {
      onMount(setSelectedNode);
   }, [onMount, selectedNode]);

   const saveChanges = () => {
      onSave(selectedNode);
   }

   const closePopup = () => {
      onClose();
   }

   return (
      <div id="node-popUp">
         <span id="node-operation">Edit Node</span> <br />
         <table style={{"margin": "auto"}}>
         <tbody>
         {
               Object.entries(selectedNode.attributes === undefined ? {} : selectedNode.attributes).map(([key, val], index) => {
                  return(
                     <tr key={index} >
                     <td>{key}</td>
                     <td>
                           <input value={val} onChange = {(e) => { 
                                 setSelectedNode({...selectedNode, attributes: {...selectedNode.attributes, [key]: e.target.value}}) 
                              }}>
                           </input>
                     </td>
                     </tr>
                  );
               }) 
         }
         </tbody>
         </table>
         <input type="button" value="save" id="node-saveButton" onClick={saveChanges} />
         <input type="button" value="Close" id="node-closeButton" onClick={closePopup}/>
      </div>
   )
}

export default NodePopup
