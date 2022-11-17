import React, {useState} from "react";

const SearchBar = (props) =>{

    const nodes = props.data;
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
        <div id="form-wrapper">
            <div id="form-div">
            <form id="search-form" onSubmit={handleSubmit}>
                <input type="text" value={node} onChange={handleChange} placeholder="Search by node ID"></input>
                <button type="submit" onSubmit={handleSubmit}>Find</button>   
                <button id="btn-next" onClick={handleNext}>Next</button>
                <button id="btn-prev" onClick={handlePrev}>Prev</button>
                <button id='btn-reset' onClick={handleReset}>Reset</button>
            </form>
            </div>
        </div>
        </>
    );
}

export default SearchBar;