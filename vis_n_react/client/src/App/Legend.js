import React, {useEffect, useRef } from 'react';
import { Network } from 'vis-network';
import { DataSet} from 'vis-data';
import '../styles/vis-network.css';
import "../styles/Legend.css";
import loadImg from '../imgs/load.png';
import capacitorImg from '../imgs/capacitor.jpg';
import inverterImg from '../imgs/inverter.png';
import meterImg from '../imgs/meter.jpg';
import substationImg from '../imgs/substation.jpg';
import generatorImg from '../imgs/generator.jpg';
import nodeImg from '../imgs/node.png';

const nodeOptions = new Map([["load", {"group": "load"}],
                    ["triplex_load", {"group": "triplex_load"}],
                    ["capacitor", {"group": "capacitor"}],
                    ["triplex_node", {"group": "triplex_node"}],
                    ["substation", {"group": "substation"}],
                    ["triplex_meter", {"group": "triplex_meter"}],
                    ["node", {"group": "node"}],
                    ["meter", {"group": "meter"}],
                    ["inverter", {"group": "inverter"}],
                    ["inverter_dyn", {"group": "inverter"}],
                    ["diesel_dg", {"group": "generator"}]]);

const edgeOptions = new Map([["overhead_line", {"width": 4, "color": "#000000"}],
                            ["switch", {"width": 4, "color": "#3a0ca3"}],
                            ["series_reactor", {"width": 4, "color": "#8c0000"}],
                            ["triplex_line", {"width": 4, "color": "#c86bfa"}],
                            ["underground_line", {"width": 4, "color": "#FFFF00"}],
                            ["regulator", {"width": 4, "color": "#ff447d"}],
                            ["transformer", {"width": 4, "color": "#00FF00"}]]);

var network = null;
const nodes = [];
const edges = [];

nodes.push({
    id: 1,
    x: -200, 
    y: 0,
    fixed: true,
    physics: false,
    label: "load",
    group: nodeOptions.get("load").group
});

nodes.push({
    id: 2,
    x: -100, 
    y: 0,
    fixed: true,
    physics: false,
    label: "node",
    group: nodeOptions.get("node").group
});

nodes.push({
    id: 3,
    x: 0, 
    y: 0,
    fixed: true,
    physics: false,
    label: "meter",
    group: nodeOptions.get("meter").group
});

nodes.push({
    id: 4,
    x: 100, 
    y: 0,
    fixed: true,
    physics: false,
    label: "inverter",
    group: nodeOptions.get("inverter").group
});

nodes.push({
    id: 5,
    x: 200, 
    y: 0,
    fixed: true,
    physics: false,
    label: "diesel_dg",
    group: nodeOptions.get("diesel_dg").group
});

nodes.push({
    id: 6,
    x: 300, 
    y: 0,
    fixed: true,
    physics: false,
    label: "capacitor",
    group: nodeOptions.get("capacitor").group
});

nodes.push({
    id: 7,
    x: -125, 
    y: 100,
    fixed: true,
    physics: false,
    label: "triplex_load",
    group: nodeOptions.get("triplex_load").group
});

nodes.push({
    id: 8,
    x: 0, 
    y: 100,
    fixed: true,
    physics: false,
    label: "triplex_node",
    group: nodeOptions.get("triplex_node").group
});

nodes.push({
    id: 9,
    x: 125, 
    y: 100,
    fixed: true,
    physics: false,
    label: "triplex_meter",
    group: nodeOptions.get("triplex_meter").group
});

nodes.push({
    id: 10,
    x: 250, 
    y: 100,
    fixed: true,
    physics: false,
    label: "substation",
    group: nodeOptions.get("substation").group
});


//Edge nodes
nodes.push({
    id:100,
    x: -150,
    y: 250,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:101,
    x: 250,
    y: 250,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:102,
    x: -150,
    y: 325,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:103,
    x: 250,
    y: 325,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:104,
    x: -150,
    y: 400,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:105,
    x: 250,
    y: 400,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:106,
    x: -150,
    y: 475,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:107,
    x: 250,
    y: 475,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:108,
    x: -150,
    y: 550,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:109,
    x: 250,
    y: 550,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:110,
    x: -150,
    y: 625,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:111,
    x: 250,
    y: 625,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:112,
    x: -150,
    y: 700,
    fixed: true,
    physics: false,
    color: "black"
});

nodes.push({
    id:113,
    x: 250,
    y: 700,
    fixed: true,
    physics: false,
    color: "black"
});

edges.push({
    from: 100,
    to: 101,
    id: "overhead_line",
    label: "overhead_line",
    width: edgeOptions.get("overhead_line").width,
    color: edgeOptions.get("overhead_line").color
});

edges.push({
    from: 102,
    to: 103,
    id: "switch",
    label: "switch",
    width: edgeOptions.get("switch").width,
    color: edgeOptions.get("switch").color
});

edges.push({
    from: 104,
    to: 105,
    id: "underground_line",
    label: "underground_line",
    width: edgeOptions.get("underground_line").width,
    color: edgeOptions.get("underground_line").color
});

edges.push({
    from: 106,
    to: 107,
    id: "regulator",
    label: "regulator",
    width: edgeOptions.get("regulator").width,
    color: edgeOptions.get("regulator").color
});

edges.push({
    from: 108,
    to: 109,
    id: "transformer",
    label: "transformer",
    width: edgeOptions.get("transformer").width,
    color: edgeOptions.get("transformer").color
});

edges.push({
    from: 110,
    to: 111,
    id: "triplex_line",
    label: "triplex_line",
    width: edgeOptions.get("triplex_line").width,
    color: edgeOptions.get("triplex_line").color
});

edges.push({
    from: 112,
    to: 113,
    id: "series_reactor",
    label: "series_reactor",
    width: edgeOptions.get("series_reactor").width,
    color: edgeOptions.get("series_reactor").color
});

const nodesDataSet = new DataSet(nodes);
const edgesDataSet = new DataSet(edges);

const data = {
    nodes: nodesDataSet,
    edges: edgesDataSet
}

const options = {
    "nodes":{
        "font":{
            "size": 20
        }
    },
    "edges":{
        "font":{
            "size": 30,
        }
    },
    "groups":{
        "load": {"color": "#2a9d8f", "borderWidth": 4, "shape": "circularImage", "image": loadImg},
        "triplex_load":{"color": "#ffea00", "borderWidth": 4, "shape": "circularImage","image": loadImg},
        "capacitor":{"color": "#283618", "borderWidth": 4, "shape": "circularImage","image": capacitorImg},
        "triplex_node":{"color": "#003566", "borderWidth": 4, "shape": "circularImage","image": nodeImg},
        "substation":{"color": "#fca311", "borderWidth": 4, "shape": "circularImage","image": substationImg},
        "triplex_meter":{"color": "#072ac8", "borderWidth": 4, "shape": "circularImage","image": meterImg},
        "node":{"color": "#4361ee", "borderWidth": 4, "shape": "circularImage", "image": nodeImg},
        "meter":{"color": "#d90429", "borderWidth": 4, "shape": "circularImage", "image": meterImg},
        "inverter":{"color": "#c8b6ff", "borderWidth": 4, "shape": "circularImage", "image": inverterImg},
        "generator":{"color": "#fee440", "borderWidth": 4, "shape": "circularImage", "image": generatorImg},
    },
};

const Legend = (props) => {
    const container = useRef(null);
    
    useEffect(() => {
        network = new Network(container.current, data, options);

        network.on('doubleClick', function(params) {
            if(params.nodes[0])
            {
                let g = data.nodes.get(params.nodes[0]);
                props.findGroup(g.group);
            }
            if(params.edges[0])
            {
                let e = data.edges.get(params.edges[0]);
                props.findEdges(e.id);
            }
        });
    }, [container, props]);

    return (
    <>
        <div className='visLegend' ref={container} />
    </>);
};

export default Legend;