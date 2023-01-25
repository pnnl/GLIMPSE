import React from 'react';
import '../styles/GlmFileUpload.css'
import { useState, useRef } from 'react'

const GlmFileUpload = (props) => {
    // drag state
    const [dragActive, setDragActive] = useState(false);
    // ref
    const inputRef = useRef(null);
    
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === "dragenter" || e.type === "dragover") 
        {
            setDragActive(true);
        } 
        else if (e.type === "dragleave") 
        {
            setDragActive(false);
        }
    };

    // triggers when file is dropped
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) 
        {
            const files = e.dataTransfer.files;
            props.fileUpload(files);
        }
    };

    // triggers when file is selected with click
    const handleChange = (e) => {
        e.preventDefault();

        if (e.target.files && e.target.files[0]) 
        {
            // const formData = new FormData();
            const files = e.target.files;
            props.fileUpload(files);
        }
    };

    // triggers the input when the button is clicked
    const onButtonClick = () => {
        inputRef.current.click();
    };

    return (
        <div className='file-upload-form-container'>
            <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
                <input ref={inputRef} type="file" accept='.glm,.json' id="input-file-upload" multiple={true} onChange={handleChange} />
                <label id="label-file-upload" htmlFor="input-file-upload" className={dragActive ? "drag-active" : "" }>
                <div>
                    <p>Drag and drop your glm files here or</p>
                    <button className="upload-button" onClick={onButtonClick}>Upload files</button>
                </div> 
                </label>
                { dragActive && <div id="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
            </form>
        </div>    
    );
};


export default GlmFileUpload