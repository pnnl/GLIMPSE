import React, {useState} from "react";
import "../styles/SearchBar.css"

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

    const togglePhysics = () =>
    {
        var checkBox = document.getElementById("phyCheck");
        var toggle = checkBox.checked ? true : false;
        props.togglePhy(toggle);
    }

    return (
        <>
        <div className="form-wrapper">
            <form className="search-nav-form" onSubmit={handleSubmit}>
                <div className="physics-switch">
                    <label className="physics-lbl">Toggle Physics: </label>
                    <label className="switch">
                        <input type="checkbox" id="phyCheck" onClick={togglePhysics}></input>
                        <span className="slider round"></span>
                    </label>
                </div>
                    <input type="text" value={node} onChange={handleChange} placeholder="Search by node ID"></input>
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