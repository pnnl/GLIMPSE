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
import microGridImg from '../imgs/microgrid.svg';
import commImg from "../imgs/comm.jpg";
import LegendContextMenu from './LegendContextMenu';


const Legend = ({findGroup, findEdges, nodeCounts, hideObjects}) => {

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
                        ["diesel_dg", {"group": "generator"}],
                        ["microgrid_node", {"group": "microgrid_node"}],
                        ["communication_node", {"group": "communication_node"}]]);
    
    const edgeOptions = new Map([["overhead_line", {"width": 4, "color": "#000000"}],
                                ["switch", {"width": 4, "color": "#3a0ca3"}],
                                ["series_reactor", {"width": 4, "color": "#3c1642"}],
                                ["triplex_line", {"width": 4, "color": "#c86bfa"}],
                                ["underground_line", {"width": 4, "color": "#FFFF00"}],
                                ["regulator", {"width": 4, "color": "#ff447d"}],
                                ["transformer", {"width": 4, "color": "#00FF00"}],
                                ["communication", {"width": 4, "color": "#c1121f"}],
                                ["mapping", {"width": 4, "color": "#6b9080"}],
                                ["microgrid_connection", {"width": 4, "color": "cyan"}]]);
    
    const nodes = [];
    const edges = [];
    
    nodes.push({
        id: "load",
        x: 37, 
        y: -22,
        fixed: false,
        physics: false,
        label: `load\n[${nodeCounts.nodes.load}]`,
        group: nodeOptions.get("load").group
    });
    
    nodes.push({
        id: "node",
        x: 166, 
        y: -22,
        fixed: false,
        physics: false,
        label: `node\n[${nodeCounts.nodes.node}]`,
        group: nodeOptions.get("node").group
    });
    
    nodes.push({
        id: "meter",
        x: 297, 
        y: -22,
        fixed: false,
        physics: false,
        label: `meter\n[${nodeCounts.nodes.meter}]`,
        group: nodeOptions.get("meter").group
    });
    
    nodes.push({
        id: "inverter",
        x: 424, 
        y: -22,
        fixed: false,
        physics: false,
        label: `inverter\n[${nodeCounts.nodes.inverter === 0 ? nodeCounts.nodes.inverter_dyn : nodeCounts.nodes.inverter}]`,
        group: nodeOptions.get("inverter").group
    });
    
    nodes.push({
        id: "diesel_dg",
        x: 562, 
        y: -22,
        fixed: false,
        physics: false,
        label: `diesel_dg\n[${nodeCounts.nodes.diesel_dg}]`,
        group: nodeOptions.get("diesel_dg").group
    });
    
    nodes.push({
        id: 6,
        x: 700, 
        y: -22,
        fixed: false,
        physics: false,
        label: `capacitor\n[${nodeCounts.nodes.capacitor}]`,
        group: nodeOptions.get("capacitor").group
    });

    //Bottom nodes    
    nodes.push({
        id: "triplex_load",
        x: 37, 
        y: 100,
        fixed: false,
        physics: false,
        label: `triplex_load\n[${nodeCounts.nodes.triplex_load}]`,
        group: nodeOptions.get("triplex_load").group
    });
    
    nodes.push({
        id: "triplex_node",
        x: 166 , 
        y: 100,
        fixed: false,
        physics: false,
        label: `triplex_node\n[${nodeCounts.nodes.triplex_node}]`,
        group: nodeOptions.get("triplex_node").group
    });
    
    nodes.push({
        id: "triplex_meter",
        x: 297, 
        y: 100,
        fixed: false,
        physics: false,
        label: `triplex_meter\n[${nodeCounts.nodes.triplex_meter}]`,
        group: nodeOptions.get("triplex_meter").group
    });
    
    nodes.push({
        id: "substation",
        x: 424, 
        y: 100,
        fixed: false,
        physics: false,
        label: `substation\n[${nodeCounts.nodes.substation}]`,
        group: nodeOptions.get("substation").group
    });
    
    nodes.push({
        id: "communication_node",
        x: 562, 
        y: 100,
        fixed: false,
        physics: false,
        label: "communication\nnode",
        group: nodeOptions.get("communication_node").group
    });

    nodes.push({
        id: "microgrid_node",
        x: 700, 
        y: 100,
        fixed: false,
        physics: false,
        label: "End\nPoints",
        group: nodeOptions.get("microgrid_node").group
    });
    
    //Edge nodes
    nodes.push({
        id:100,
        x: 37,
        y: 250,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:101,
        x: 700,
        y: 250,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:102,
        x: 37,
        y: 325,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:103,
        x: 700,
        y: 325,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:104,
        x: 37,
        y: 400,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:105,
        x: 700,
        y: 400,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:106,
        x: 37,
        y: 475,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:107,
        x: 700,
        y: 475,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:108,
        x: 37,
        y: 550,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:109,
        x: 700,
        y: 550,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:110,
        x: 37,
        y: 625,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:111,
        x: 700,
        y: 625,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:112,
        x: 37,
        y: 700,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:113,
        x: 700,
        y: 700,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:114,
        x: 37,
        y: 775,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:115,
        x: 700,
        y: 775,
        fixed: false,
        physics: false,
        color: "black"
    });

    nodes.push({
        id:116,
        x: 37,
        y: 850,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:117,
        x: 700,
        y: 850,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:118,
        x: 37,
        y: 925,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    nodes.push({
        id:119,
        x: 700,
        y: 925,
        fixed: false,
        physics: false,
        color: "black"
    });
    
    edges.push({
        from: 100,
        to: 101,
        id: "overhead_line",
        label: `overhead_line [${nodeCounts.edges.overhead_line}]`,
        width: edgeOptions.get("overhead_line").width,
        color: edgeOptions.get("overhead_line").color
    });
    
    edges.push({
        from: 102,
        to: 103,
        id: "switch",
        label: `switch [${nodeCounts.edges.switch}]`,
        width: edgeOptions.get("switch").width,
        color: edgeOptions.get("switch").color
    });
    
    edges.push({
        from: 104,
        to: 105,
        id: "underground_line",
        label: `underground_line [${nodeCounts.edges.underground_line}]`,
        width: edgeOptions.get("underground_line").width,
        color: edgeOptions.get("underground_line").color
    });
    
    edges.push({
        from: 106,
        to: 107,
        id: "regulator",
        label: `regulator [${nodeCounts.edges.regulator}]`,
        width: edgeOptions.get("regulator").width,
        color: edgeOptions.get("regulator").color
    });
    
    edges.push({
        from: 108,
        to: 109,
        id: "transformer",
        label: `transformer [${nodeCounts.edges.transformer}]`,
        width: edgeOptions.get("transformer").width,
        color: edgeOptions.get("transformer").color
    });
    
    edges.push({
        from: 110,
        to: 111,
        id: "triplex_line",
        label: `triplex_line [${nodeCounts.edges.triplex_line}]`,
        width: edgeOptions.get("triplex_line").width,
        color: edgeOptions.get("triplex_line").color
    });
    
    edges.push({
        from: 112,
        to: 113,
        id: "series_reactor",
        label: `series_reactor [${nodeCounts.edges.series_reactor}]`,
        width: edgeOptions.get("series_reactor").width,
        color: edgeOptions.get("series_reactor").color
    });

    edges.push({
        from: 114,
        to: 115,
        id: "communication",
        label: `communication`,
        width: edgeOptions.get("communication").width,
        color: edgeOptions.get("communication").color
    });

    edges.push({
        from: 116,
        to: 117,
        id: "microgrid_connection",
        label: `microgrid_connection`,
        width: edgeOptions.get("microgrid_connection").width,
        color: edgeOptions.get("microgrid_connection").color
    });

    edges.push({
        from: 118,
        to: 119,
        id: "mapping",
        label: `mapping`,
        width: edgeOptions.get("mapping").width,
        color: edgeOptions.get("mapping").color
    });
    
    const nodesDataSet = new DataSet(nodes);
    const edgesDataSet = new DataSet(edges);
    
    const options = {
        "nodes":{
            "borderWidth": 2,
            "font":{
                "color": "#000",
                "size": 20
            }
        },
        "edges":{
            "font":{
                "color": "#000",
                "size": 30,
            }
        },
        "groups":{
            "load": {"color": "#2a9d8f", "shape": "circularImage", "image": loadImg},
            "triplex_load":{"color": "#ffea00", "shape": "circularImage","image": loadImg},
            "capacitor":{"color": "#283618", "shape": "circularImage","image": capacitorImg},
            "triplex_node":{"color": "#003566", "shape": "circularImage","image": nodeImg},
            "substation":{"color": "#fca311", "shape": "circularImage","image": substationImg},
            "triplex_meter":{"color": "#072ac8", "shape": "circularImage","image": meterImg},
            "node":{"color": "#4361ee", "shape": "circularImage", "image": nodeImg},
            "meter":{"color": "#d90429", "shape": "circularImage", "image": meterImg},
            "inverter":{"color": "#c8b6ff", "shape": "circularImage", "image": inverterImg},
            "generator":{"color": "#fee440", "shape": "circularImage", "image": generatorImg},
            "communication_node": {"color": "#c1121f", "size": 25, "shape": "image", "image": commImg},
            "microgrid_node": {"color": "#6b9080", "size": 25, "shape": "image", "image": microGridImg}
        }
    };
    
    const data = {
        nodes: nodesDataSet,
        edges: edgesDataSet
    }
    
    const container = useRef(null);

    let contextMenuData;
    let setContextMenuData;
    const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
    }

    const handleContext = (e) => {
        e.preventDefault();
    
        setContextMenuData( contextMenuData !== null ? {
          ...contextMenuData,
            mouseX: e.pageX + 2,
            mouseY: e.pageY + 6,
          } : null
        );
    }
    
    useEffect(() => {

        const network = new Network(container.current, data, options);

        network.on('doubleClick', function(params) {
            if(params.nodes[0])
            {
                let g = data.nodes.get(params.nodes[0]);
                findGroup(g.group);
            }
            if(params.edges[0])
            {
                let e = data.edges.get(params.edges[0]);
                findEdges(e.id);
            }
        });

        network.on("oncontext", params => {
            if(network.getNodeAt(params.pointer.DOM))
            {
                const ID = network.getNodeAt(params.pointer.DOM);
                setContextMenuData({object: data.nodes.get(ID).group,type: "node"});
            }
            else if (network.getEdgeAt(params.pointer.DOM))
            {
                const ID = network.getEdgeAt(params.pointer.DOM);
                setContextMenuData({object: data.edges.get(ID).id, type: "edge"})
            }
        })
    });

    return (
    <>
        <div 
            className='visLegend'
            ref={container}
            onContextMenu={handleContext}
        />

        <LegendContextMenu 
            onMount={onContextMenuChildMount}
            hideObjects={hideObjects}
        />
    </>
    );
};

export default Legend;