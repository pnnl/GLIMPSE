import React, { useState } from 'react';
import "../styles/NodePopup.css";

function NodePopup(props) {

    console.log(props.currentNode);
    const [selectedNode, setSelectedNode] = useState(props.currentNode);
    console.log(selectedNode);

    const onSave = () => {
        props.onSave(selectedNode);
    }

    const onClose = () => {
        props.onClose();
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
                        setSelectedNode({...selectedNode, attributes: {...selectedNode.attributes, [key]: e.target.value}});
                        }}>
                        </input>
                    </td>
                    </tr>
                );
                }) 
            }
            </tbody>
            </table>
            <input type="button" value="save" id="node-saveButton" onClick={onSave} />
            <input type="button" value="Close" id="node-closeButton" onClick={onClose}/>
        </div>
    )
}

export default NodePopup
