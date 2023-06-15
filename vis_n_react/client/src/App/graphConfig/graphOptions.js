import loadImg from '../../imgs/load.png';
import capacitorImg from '../../imgs/capacitor.jpg';
import inverterImg from '../../imgs/inverter.png';
import meterImg from '../../imgs/meter.jpg';
import substationImg from '../../imgs/substation.jpg';
import generatorImg from '../../imgs/generator.jpg';
import nodeImg from '../../imgs/node.png';
import microGridImg from '../../imgs/microgrid.svg';
import commImg from "../../imgs/comm.jpg";

//These are the graph options
const options = {
    edges: {
        smooth: {
            enabled: true,
            type: "continuous",
            roundness: 0.3
        }, 
    },
    nodes: {
        shapeProperties: {
            interpolation: false
        },
        font: {
            color: "black",
            size: 20
        }
    },
    groups:{ //These options can be changes to affect the style of each node type
        load: {"color": "#2a9d8f","size": 15, "borderWidth": 2, "shape": "circularImage", "image": loadImg},
        triplex_load:{"color": "#ffea00","size": 15, "borderWidth": 2, "shape": "circularImage","image": loadImg},
        capacitor:{"color": "#283618","size": 15, "borderWidth": 2, "shape": "circularImage","image": capacitorImg},
        triplex_node:{"color": "#003566","size": 15, "borderWidth": 2, "shape": "circularImage","image": nodeImg},
        substation:{"color": "#fca311","size": 15, "borderWidth": 2, "shape": "circularImage","image": substationImg},
        triplex_meter:{"color": "#072ac8","size": 15, "borderWidth": 2, "shape": "circularImage","image": meterImg},
        node:{"color": "#4361ee","size": 15, "borderWidth": 2, "shape": "circularImage", "image": nodeImg},
        meter:{"color": "#d90429","size": 15, "borderWidth": 2, "shape": "circularImage", "image": meterImg},
        inverter:{"color": "#c8b6ff","size": 15, "borderWidth": 2, "shape": "circularImage", "image": inverterImg},
        generator:{"color": "#fee440","size": 15, "borderWidth": 2, "shape": "circularImage", "image": generatorImg},
        communication_node: {"color": "#c1121f", "size": 25, "borderWidth": 2, "shape": "image", "image": commImg},
        microgrid_node: {"color": "#6b9080", "size": 25, "borderWidth": 2, "shape": "image", "image": microGridImg},

    },
    interaction: {
        hover:true,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
        navigationButtons: true
    },
    physics: {
        barnesHut: {
            gravitationalConstant: -80_000, // this value effects graph render time and how spread out it looks
            springLength: 150, //this value if for how springy the edges are
            springConstant: 0.25, // the higher the value the springy the edges are 
        },
        maxVelocity: 150,
        minVelocity: 0.25,
        solver: 'barnesHut',
        stabilization: {
            enabled: false,
            iterations: 1_000,
            updateInterval: 1,
            onlyDynamicEdges: false,
            fit: true
        },
    },
    layout: {
        randomSeed: undefined,
        improvedLayout: false
    }
};

export default options;