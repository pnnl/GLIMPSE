import React, { useState } from "react";
import "../styles/SearchBar.css"
import axios from 'axios';

const SearchBar = (props) => {

    const nodes = props.data;
    const [node, setNode] = useState("");
    const [imgData, setImgData] = useState(null);

    const handleChange = (e) =>
    {
        setNode(e.target.value);
    }

    const handleSubmit = (e) =>
    {
        e.preventDefault();
        
        if (nodes.get(node))
        {
            props.onFind(node);
        }
        else
        {
            alert(`${node} is not in the graph.`)
        }
    }

    const handleExport = (e) => {
        e.preventDefault()
        props.export();
    }

    const handleReset = (e) =>
    {
        e.preventDefault();
        props.reset();
    }

    const handlePrev = (e) => 
    {
        e.preventDefault();
        props.prev();
    }

    const handleNext = (e) =>
    {
        e.preventDefault();
        props.next();
    }

    const togglePhysics = () =>
    {
        const checkBox = document.getElementById("phyCheck");
        props.physicsToggle(checkBox.checked);
    }

    const plot = async (e) => 
    {
        e.preventDefault();
        const axios_instance = axios.create({
            baseURL: 'http://localhost:3500',
            timeout: 5000
          });

        await axios_instance
            .get("/getplot",{responseType: 'arraybuffer' })
            .then( ( res ) => {
                const buffer = Buffer.from(res.data, 'binary').toString('base64');
                setImgData(`data:${res.headers['content-type']};base64,${buffer}`);
            })
            .catch(( err ) => console.log( err ))
        
       
    }

    return (
        <>
        <div className="form-wrapper">
            <form className="search-nav-form">
                <button className="export-btn" onClick={handleExport}>Export w/ Changes</button>
                <button className="plt-btn" onClick={plot}>Show Plot</button>

                <div className="physics-switch">
                    <label className="physics-lbl">Toggle Physics: </label>
                    <label className="switch">
                        <input type="checkbox" id="phyCheck" onClick={togglePhysics}></input>
                        <span className="slider round"></span>
                    </label>
                </div>
                
                <input className="node-search" type="text" value={node} onChange={handleChange} placeholder="Search by node ID"></input>
                <button className = "find-btn" onClick={handleSubmit}>Find</button>
                <button className = "prev-btn" onClick={handlePrev}>Prev</button>
                <button className = "next-btn" onClick={handleNext}>Next</button>
                <button className = "reset-btn" onClick={handleReset}>Reset</button>
            </form>
        </div>
        </>
    );
}

export default SearchBar;