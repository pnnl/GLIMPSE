import React, {useState} from "react";

const SearchBar = (props) =>{

    const nodes = props.data;
    const prevBtn = document.getElementById("btn-prev");
    const [node, setNode] = useState("");
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
            alert(node + " is not in the graph.")
        }
    }

    const ready = (e) =>
    {
        prevBtn.disabled = true;
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

    return (
        <>
            <form onLoad={ready} onSubmit={handleSubmit}>
                <input type="text" value={node} onChange={handleChange} placeholder="Search by node ID"></input>
                <button type="submit" onSubmit={handleSubmit}>Find</button>
                <button id='btn-reset' onClick={handleReset}>Reset</button>
                <button id="btn-prev" onClick={handlePrev}>Prev</button>
                <button id="btn-next" onClick={handleNext}>Next</button>
            </form>
        </>
    );
}

export default SearchBar;