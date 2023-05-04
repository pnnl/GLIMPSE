import React, { useState } from "react";
import "../styles/SearchBar.css";
import PlotModal from "./PlotModal";
import axios from 'axios';

const SearchBar = (props) => {

    const nodes = props.data;
    const [node, setNode] = useState("");
    const [imgUrl, setImgUrl] = useState(null);
    const [showPlot, setShowPlot] = useState(false);

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

        setShowPlot(true);

        await axios.get("http://localhost:3500/getplot", {responseType: 'blob' })
            .then( ( { data: blob } ) => {
                const imageUrl = URL.createObjectURL(blob);
                setImgUrl(imageUrl);
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
        <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)}/>
        </>
    );
}

export default SearchBar;