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
        borderWidth: 2,
        shapeProperties: {
            useBorderWithImage: true,
            interpolation: false
        },
        font: {
            color: "#000",
            size: 30
        },
        shape: 'circularImage',
    },
    groups:{ //These options can be changes to affect the style of each node type
        load: {
            color: "#2a9d8f",
            size: 50,
            image: loadImg
        },
        triplex_load: {
            color: "#ffea00",
            size: 50,
            image: loadImg
        },
        capacitor: {
            color: "#283618",
            size: 50,
            image: capacitorImg
        },
        triplex_node: {
            color: "#003566",
            size: 50,
            image: nodeImg
        },
        substation: {
            color: "#fca311",
            size: 50, 
            image: substationImg
        },
        triplex_meter: {
            color: "#072ac8",
            size: 50, 
            image: meterImg
        },
        node: {
            color: "#4361ee",
            size: 50, 
            image: nodeImg
        },
        meter: {
            color: "#d90429",
            size: 50, 
            image: meterImg
        },
        inverter: {
            color: "#c8b6ff",
            size: 50, 
            image: inverterImg
        },
        generator: {
            color: "#fee440",
            size: 50, 
            image: generatorImg
        },
        communication_node: {
            color: "#c1121f",
            size: 50, 
            shape: "image",
            image: commImg
        },
        microgrid_node: {
            color: "#6b9080",
            size: 50, 
            shape: "image",
            image: microGridImg
        },

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