import React, { useState } from "react";
import "../styles/SearchBar.css";
import axios from "axios";
import PlotModal from "./PlotModal";

const SearchBar = ({data, onFind, download, reset, prev, next, physicsToggle}) => {

    const nodes = data;
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
            onFind(node);
        }
        else
        {
            alert(`${node} is not in the graph.`)
        }
    }

    const handleExport = (e) => {
        e.preventDefault()
        download();
    }

    const handleReset = (e) =>
    {
        e.preventDefault();
        reset();
    }

    const handlePrev = (e) => 
    {
        e.preventDefault();
        prev();
    }

    const handleNext = (e) =>
    {
        e.preventDefault();
        next();
    }

    const togglePhysics = () =>
    {
        const checkBox = document.getElementById("phyCheck");
        physicsToggle(checkBox.checked);
    }

    const plot = async (e) => 
    {
        e.preventDefault();
        
        if(imgUrl === null)
        {
            await axios.get("http://localhost:3500/getplot", {responseType: 'blob' }).then( ( { data: blob } ) => {
                let imageUrl = URL.createObjectURL(blob);
                setImgUrl(imageUrl);
                setShowPlot(true);
            })
            .catch(( err ) => console.log( err ))
        }
        else
        {
            setShowPlot(true);
        }
  
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