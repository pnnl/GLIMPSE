/* Change paths for each objects icon/image */
import loadImg from '../imgs/load.png';
import capacitorImg from '../imgs/capacitor.jpg';
import inverterImg from '../imgs/inverter.png';
import meterImg from '../imgs/meter.jpg';
import substationImg from '../imgs/substation.jpg';
import generatorImg from '../imgs/generator.jpg';
import nodeImg from '../imgs/node.png';
import microGridImg from '../imgs/microgrid.svg';
import commImg from '../imgs/comm.jpg';

const nodeSize = 12;

const appConfig = {
   'appOptions': { /* Labels for entire gui */
      'title': "Power Grid Model Visualization Tool",
      'nav': {
         'home': "Home",
         'about': "About"
      },
      'buttons': {
         'exportBtn': "EXPORT W/ CHANGES",
         'plotBtn': "SHOW PLOT",
         'addOverlayBtn': "ATTACH OVERLAY",
         'simBtn': "CONNECT TO SIM",
         'layoutLbl': "Auto Layout",
         'searchLbl': "Search by node id",
         'previousBtn': "PREV",
         'nextBtn': "NEXT",
         "resetBtn": "RESET"
      }
   },
   'graphOptions': { /* Options for graph generation */
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
         size: nodeSize
      },
      groups:{
         load: {
            color: "#2a9d8f",
            size: nodeSize,
            shape: 'circularImage',
            image: loadImg
         },
         triplex_load: {
            color: "#ffea00",
            size: nodeSize,
            shape: 'circularImage',
            image: loadImg
         },
         capacitor: {
            color: "#283618",
            size: nodeSize,
            shape: 'circularImage',
            image: capacitorImg
         },
         triplex_node: {
            color: "#003566",
            size: nodeSize,
            shape: 'circularImage',
            image: nodeImg
         },
         substation: {
            color: "#fca311",
            size: nodeSize, 
            shape: 'circularImage',
            image: substationImg
         },
         triplex_meter: {
            color: "#072ac8",
            size: nodeSize, 
            shape: 'circularImage',
            image: meterImg
         },
         node: {
            color: "#4361ee",
            size: nodeSize,
            shape: 'circularImage', 
            image: nodeImg
         },
         meter: {
            color: "#d90429",
            size: nodeSize,
            shape: 'circularImage', 
            image: meterImg
         },
         inverter: {
            color: "#c8b6ff",
            size: nodeSize,
            shape: 'circularImage', 
            image: inverterImg
         },
         generator: {
            color: "#fee440",
            size: nodeSize,
            shape: 'circularImage', 
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
            gravitationalConstant: -10000,
            springConstant: 0.25,
            springLength: 35
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
         randomSeed: undefined,
         improvedLayout: false
      }
   }
}

export default appConfig;