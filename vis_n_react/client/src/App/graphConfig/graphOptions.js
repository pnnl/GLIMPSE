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
const nodeSize = 50;

const options = {
    edges: {
        smooth: {
            enabled: true,
            type: "continuous",
        },
    },
    nodes: {
        borderWidth: 2,
        shapeProperties: {
            useBorderWithImage: true,
        },
        font: {
            color: "#000",
            size: 30
        },
        shape: 'circularImage'
    },
    groups:{ //These options can be changes to affect the style of each node type
        load: {
            color: "#2a9d8f",
            size: nodeSize,
            image: loadImg
        },
        triplex_load: {
            color: "#ffea00",
            size: nodeSize,
            image: loadImg
        },
        capacitor: {
            color: "#283618",
            size: nodeSize,
            image: capacitorImg
        },
        triplex_node: {
            color: "#003566",
            size: nodeSize,
            image: nodeImg
        },
        substation: {
            color: "#fca311",
            size: nodeSize, 
            image: substationImg
        },
        triplex_meter: {
            color: "#072ac8",
            size: nodeSize, 
            image: meterImg
        },
        node: {
            color: "#4361ee",
            size: nodeSize, 
            image: nodeImg
        },
        meter: {
            color: "#d90429",
            size: nodeSize, 
            image: meterImg
        },
        inverter: {
            color: "#c8b6ff",
            size: nodeSize, 
            image: inverterImg
        },
        generator: {
            color: "#fee440",
            size: nodeSize, 
            image: generatorImg
        },
        communication_node: {
            color: "#c1121f",
            size: nodeSize, 
            shape: "image",
            image: commImg
        },
        microgrid_node: {
            color: "#6b9080",
            size: nodeSize, 
            shape: "image",
            image: microGridImg
        }

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
            springConstant: 0.25, // the higher the value the springy the edges are 
            springLength: 150 //this value if for how springy the edges are
        },
        solver: 'barnesHut',
        stabilization: {
            enabled: false,
            iterations: 1000,
            updateInterval: 1,
            onlyDynamicEdges: false,
            fit: true
        }
    },
    layout: {
        improvedLayout: false
    }
};

export default options;