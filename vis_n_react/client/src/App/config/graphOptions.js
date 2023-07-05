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
const nodeSize = 12;

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
            size: 18
        },
        shape: 'circularImage',
        size: nodeSize
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
            theta: 0.1,
            gravitationalConstant: -10000,
            centralGravity: 0.3,
            springConstant: 0.25,
            springLength: 35
        },
        maxVelocity: 100,
        minVelocity: 1,
        solver: 'barnesHut', /* Change solver to any solver algorithm above */
        stabilization: {
            enabled: false,
            iterations: 1000,
            updateInterval: 1,
            onlyDynamicEdges: false,
            fit: true
        }
    },
    layout: {
        randomSeed: undefined,
        improvedLayout: false
    }
};

export default options;