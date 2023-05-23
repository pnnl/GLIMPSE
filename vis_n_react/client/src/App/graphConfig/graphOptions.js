import loadImg from '../../imgs/load.png';
import capacitorImg from '../../imgs/capacitor.jpg';
import inverterImg from '../../imgs/inverter.png';
import meterImg from '../../imgs/meter.jpg';
import substationImg from '../../imgs/substation.jpg';
import generatorImg from '../../imgs/generator.jpg';
import nodeImg from '../../imgs/node.png';

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
        }
    },
    groups:{ //These options can be changes to affect the style of each node type
        load: {"color": "#2a9d8f","size": 10, "borderWidth": 2, "shape": "circularImage", "image": loadImg},
        triplex_load:{"color": "#ffea00","size": 10, "borderWidth": 2, "shape": "circularImage","image": loadImg},
        capacitor:{"color": "#283618","size": 10, "borderWidth": 2, "shape": "circularImage","image": capacitorImg},
        triplex_node:{"color": "#003566","size": 10, "borderWidth": 2, "shape": "circularImage","image": nodeImg},
        substation:{"color": "#fca311","size": 10, "borderWidth": 2, "shape": "circularImage","image": substationImg},
        triplex_meter:{"color": "#072ac8","size": 10, "borderWidth": 2, "shape": "circularImage","image": meterImg},
        node:{"color": "#4361ee","size": 10, "borderWidth": 2, "shape": "circularImage", "image": nodeImg},
        meter:{"color": "#d90429","size": 10, "borderWidth": 2, "shape": "circularImage", "image": meterImg},
        inverter:{"color": "#c8b6ff","size": 10, "borderWidth": 2, "shape": "circularImage", "image": inverterImg},
        generator:{"color": "#fee440","size": 10, "borderWidth": 2, "shape": "circularImage", "image": generatorImg},
        communication_node: {"color": "#c1121f", "size": 25, "borderWidth": 2, "shape": "square"},
        microgrid_node: {"color": "#6b9080", "size": 25, "borderWidth": 2, "shape": "square"},

    },
    interaction: {
        hover:true,
        hideEdgesOnDrag: true,
        hideEdgesOnZoom: true,
        navigationButtons: true
    },
    physics: {
        barnesHut: {
            gravitationalConstant: -80000, // this value effects graph render time and how spread out it looks
            springLength: 75, //this value if for how springy the edges are
            springConstant: 0.04, // the higher the value the springy the edges are 
        },
        maxVelocity: 150,
        minVelocity: 0.25,
        solver: 'barnesHut',
        stabilization: {
            enabled: true,
            iterations: 1000,
            updateInterval: 1,
            onlyDynamicEdges: false,
            fit: true
        },
    },
    layout: {
        randomSeed: undefined,
        // hierarchical: {
        //     direction: "Up-Down"
        // },
        improvedLayout: false
    }
};

export default options;