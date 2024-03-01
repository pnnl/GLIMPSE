import React, { useEffect, useRef} from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import ActionBar from "./ActionBar";
import NodePopup from "./NodePopup";
import "./styles/vis-network.css";
import "./styles/Graph.css";
import Legend from "./Legend";
import EdgeContextMenu from "./EdgeContextMenu";
import appConfig from "./config/appConfig.json";
const options = appConfig.graphOptions;

/**
* Converts an object of attributes from a node or edge to a string to be displayed
* @param {Object} attributes - an object 
* @returns {string}
*/
const getTitle = (attributes) => {
   let str = "";

   for (let [key, val] of Object.entries(attributes)) {
      str += key + ": " + val + "\n";
   }

   return str;
}

const getHtmlLabel = (id, attributes) => {
   return (
      `\t<b>${id}</b>\n\n` + getTitle(attributes)
   )
}

const getRandColor = () => {
   const letters = "0123456789ABCDEF";
   let color = "#";

   while (color.length < 7)
      color += letters[Math.floor(Math.random() * 16)];
   
   return color;
}

/**
 * 
 * @param {Object} keysMap - format: { [ name of key to rename ]: "new key name" }
 * @param {Object} obj - The object that contains the keys you would like to rename 
 * @returns Obejct with renamed keys
 *
 * @example
 * keysMap = {
 *    name: 'firstName',
 *    job: 'passion'
 * };
 *
 * obj = {
 *    name: 'Bobo',
 *    job: 'Front-End Master'
 * };
 *
 *  renameKeys(keysMap, obj);
 * // { firstName: 'Bobo', passion: 'Front-End Master' }
*/
const renameKeys = (keysMap, obj) => {
   return Object.keys(obj).reduce(
      (prev, key) => ({
         ...prev,
         ...{[keysMap[key] || key]: obj[key]}
      }),{}
   );
}

const Graph = ({ dataToVis, theme }) => {
   const GLIMPSE_OBJECT = {"objects": []};
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const edgeOptions = theme.edgeOptions;
   let glmNetwork = null; // global network varibale
   let counter = -1; // coutner to navigate through highlighted nodes
   const highlightedNodes = [];

   /**
   * Create nodes and edges based on the object type being visualized in the main network
   * @param {Object} typeCounts - containes the counts of node and edge types
   * @returns {Object} an object containing the nodes and edges to be visualized in the legend network
   */
   const getLegendData = (typeCounts) => {
      const legendData = {
         "nodes": new DataSet(),
         "edges": new DataSet()
      };
      
      const currentNodeTypes = [];
      const currentEdgeTypes = [];

      Object.entries(typeCounts.nodes).forEach(([type, count], i) => {
         if (count > 0) currentNodeTypes.push(type);
      });

      Object.entries(typeCounts.edges).forEach(([type, count], i) => {
         if (count > 0) currentEdgeTypes.push(type);
      });

      let x_increment = null;
      if (currentNodeTypes.length < 6)
         x_increment = 800 / currentNodeTypes.length;
      else 
         x_increment = 1500 / currentNodeTypes.length;

      let farthest_x = 0;
      let current_x = 0;
      let current_y = 0;
      let rowNodeCount = 0;

      for (let nodeType of currentNodeTypes) {
         if (legendData.nodes.length === 0) {

            if (Object.keys(theme.groups).includes(nodeType)) {
               legendData.nodes.add({
                  id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
                  label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
                  size: 25,
                  color: theme.groups[nodeType].color,
                  shape: theme.groups[nodeType].shape,
                  image: theme.groups[nodeType].image,
                  group: nodeType,
                  x: current_x,
                  y: current_y,
                  physics: false,
                  fixed: true
               });
               rowNodeCount++;
               continue;
            }

            legendData.nodes.add({
               id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
               label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
               size: 25,
               shape: "dot",
               groups: nodeType,
               x: current_x,
               y: current_y,
               physics: false,
               fixed: true
            });
            rowNodeCount++;
            continue;
         }

         if (rowNodeCount === 6) {
            farthest_x = current_x;
            rowNodeCount = 0;
            current_x = 0;
            current_y -= 125;
         }
         else {
            current_x += x_increment;
         }

         if (Object.keys(theme.groups).includes(nodeType)) {
            legendData.nodes.add({
               id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
               label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
               size: 25,
               color: theme.groups[nodeType].color,
               shape: theme.groups[nodeType].shape,
               image: theme.groups[nodeType].image,
               group: nodeType,
               x: current_x,
               y: current_y,
               physics: false,
               fixed: true
            });

            rowNodeCount++;
            continue;
         }
         
         legendData.nodes.add({
            id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
            label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
            size: 25,
            shape: "dot",
            group: nodeType,
            x: current_x,
            y: current_y,
            physics: false,
            fixed: true
         });
         rowNodeCount++;
      }

      current_y = 125;
      currentEdgeTypes.forEach((type, index) => {

         legendData.nodes.add({
            id: `${type}:${index}`,
            x: current_x === farthest_x ? -250 : 0,
            y: current_y,
            fixed: true,
            physcis: false,
            color: "#000"
         });

         legendData.nodes.add({
            id: `${type}:${index + 1}`,
            x: farthest_x === current_x ? 250 : farthest_x === 0 ? current_x : farthest_x,
            y: current_y,
            fixed: true,
            physcis: false,
            color: "#000"
         })

         if (Object.keys(edgeOptions).includes(type)) {
            legendData.edges.add({
               id: type,
               from: `${type}:${index}`,
               to: `${type}:${index + 1}`,
               label: `${type} [${typeCounts.edges[type]}]`,
               width: 8,
               color: edgeOptions[type].color
            });
         }
         else {
            legendData.edges.add({
               id: type,
               from: `${type}:${index}`,
               to: `${type}:${index + 1}`,
               label: `${type} [${typeCounts.edges[type]}]`,
               width: 8,
            });
         }

         current_y += 65;
      });

      return legendData;
   }

   // data object that holds a DataSet for nodes and edges
   const data = {
      "nodes": [],
      "edges": []
   };

   // used to keep count of each object type
   const objectTypeCount = {
      "nodes": Object.keys(theme.groups).reduce((o, key) => ({...o, [key]: 0}), {}),
      "edges": Object.keys(theme.edgeOptions).reduce((o, key) => ({...o, [key]: 0}), {})
   };

   objectTypeCount.edges.parentChild = 0;

   let setLegendData;
   const legendMount = (legendSetFunc) => {
      setLegendData = legendSetFunc;
   }

   /**
   * Collects all the nodes and edges with their attributes and sets it to the data variable
   * @param {Object} dataFromFiles 
   */
   const setGraphData = (dataFromFiles) => {
      const keys = ["id", "objectType", "name"];
      const files = Object.keys(dataFromFiles).map(file => dataFromFiles[file]);

      for (const file of files) {
         const objs = file.objects;

         const newObjs = objs.map((obj) => {
            const attributes = obj.attributes;
            const nameForObjType = keys.find(key => Object.keys(obj).includes(key));
            const objectType = obj[nameForObjType];
            const nameForObjID = keys.find(key => Object.keys(attributes).includes(key));

            const nodeID = attributes[nameForObjID];
            
            if (nodeTypes.includes(objectType)) {
               if (Object.keys(attributes).includes("x") && Object.keys(attributes).includes("y")) {
                  objectTypeCount.nodes[objectType]++;
                  
                  if (!Object.keys(obj).includes("elemetType"))
                     GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
                  else
                     GLIMPSE_OBJECT.objects.push(obj);
                     
                  return ({
                     "id": nodeID,
                     "label": nodeID,
                     "elementType": "node",
                     "attributes": attributes,
                     "group": objectType,
                     "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
                     "x": parseInt(attributes.x, 10),
                     "y": parseInt(attributes.y, 10)
                  });
               }
               else if (Object.keys(attributes).includes("level")) {
                  if (!options.layout.hierarchical.enabled)
                     options.layout.hierarchical.enabled = true;
      
                  if (Object.keys(objectTypeCount.nodes).includes(objectType))
                     objectTypeCount.nodes[objectType]++;
                  else
                     objectTypeCount.nodes[objectType] = 1;
   
                  if (!Object.keys(obj).includes("elemetType"))
                     GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
                  else
                     GLIMPSE_OBJECT.objects.push(obj);
   
                  return ({
                     "id": nodeID,
                     "label": nodeID,
                     "elementType": "node",
                     "level": attributes.level,
                     "attributes": attributes,
                     "group": objectType,
                     "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
                  });
               }
                              
               objectTypeCount.nodes[objectType]++;

               obj = renameKeys({name: "objectType"}, obj);
               obj.attributes = renameKeys({name: "id"}, obj.attributes);
               
               if (!Object.keys(obj).includes("elemetType"))
                  GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
               else
                  GLIMPSE_OBJECT.objects.push(obj);

               return ({
                  "id": nodeID,
                  "label": nodeID,
                  "elementType": "node",
                  "attributes": attributes,
                  "group": objectType,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
               });
               
            }
            else if (Object.keys(obj).includes("elementType") && obj.elementType === "node") {
               if (!Object.keys(theme.groups).includes(objectType)){
                  theme.groups[objectType] = {
                     "color": getRandColor(),
                     "shape": "dot"
                  };
               }
               
               if(!nodeTypes.includes(objectType))
                  nodeTypes.push(objectType);

               if (Object.keys(objectTypeCount.nodes).includes(objectType))
                  objectTypeCount.nodes[objectType]++;
               else
                  objectTypeCount.nodes[objectType] = 1;

               GLIMPSE_OBJECT.objects.push(obj);

               return ({
                  "id": nodeID,
                  "label": nodeID,
                  "elementType": "node",
                  "size": 15,
                  "level": Object.keys(attributes).includes("level") ? attributes.level : undefined,
                  "attributes": attributes,
                  "group": objectType,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
                  "shape": "dot"
               });
            }

            return obj;
         });
      
         data.nodes = data.nodes.concat(newObjs.filter(obj => obj.elementType === "node"));
      }

      for (const file of files) {
         const objs = file.objects;

         const newObjs = objs.map((obj) => {
            const attributes = obj.attributes;
            const nameForObjType = keys.find(key => Object.keys(obj).includes(key));
            const objectType = obj[nameForObjType];
            const nameForObjID = keys.find(key => Object.keys(attributes).includes(key));

            if (nodeTypes.includes(objectType) && Object.keys(attributes).includes("parent")) {
               const nodeID = attributes[nameForObjID];
               const parent = attributes.parent;

               objectTypeCount.edges.parentChild++;

               GLIMPSE_OBJECT.objects.push({
                  "objectType": "parentChild",
                  "elementType": "edge",
                  "attributes": {
                     "id": `parentChild:${parent}-${nodeID}`,
                     "from": parent,
                     "to": nodeID
                  }
               });
               
               return ({
                  "id": `parentChild:${parent}-${nodeID}`,
                  "from": parent,
                  "to": nodeID,
                  "elementType": "edge",
                  "width": 2,
                  "attributes": {"to": parent, "from": nodeID},
                  "color": {"inherit": true}
               });
            }
            else if (edgeTypes.includes(objectType)) {  
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = objectType + ":" + attributes[nameForObjID];

               objectTypeCount.edges[objectType]++;

               obj = renameKeys({name: "objectType"}, obj);
               obj.attributes = renameKeys({name: "id"}, obj.attributes);

               GLIMPSE_OBJECT.objects.push({...obj, "elementType": "edge"});

               return ({
                  "id": edgeID,
                  "from": edgeFrom,
                  "to": edgeTo,
                  "elementType": "edge",
                  "attributes": attributes,
                  "color": edgeOptions[objectType].color,
                  "width": edgeOptions[objectType].width,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
               });
            }
            else if (Object.keys(obj).includes("elementType") && obj.elementType === "edge") {
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = objectType + ":" + attributes[nameForObjID];

               if (!Object.keys(edgeOptions).includes(objectType))
                  edgeOptions[objectType] = {"color": getRandColor()};

               if (Object.keys(objectTypeCount.edges).includes(objectType))
                  objectTypeCount.edges[objectType]++;
               else
                  objectTypeCount.edges[objectType] = 1;

               GLIMPSE_OBJECT.objects.push(obj);
               
               return ({
                  "id": edgeID,
                  "from": edgeFrom,
                  "to": edgeTo,
                  "elementType": "edge",
                  "attributes": attributes,
                  "color": edgeOptions[objectType].color,
                  "width": 2,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
               });
            }

            return obj;
         });
      
         data.edges = data.edges.concat(newObjs.filter(obj => obj.elementType === "edge"));
      }

      data.nodes = new DataSet(data.nodes);
      data.edges = new DataSet(data.edges);
   }

   /**
   * Zooms in on a node that maches the provided ID
   * @param {string} nodeID - the ID of a node 
   */
   const NodeFocus = (nodeID) => {
      const options = {
         "scale": 3,
         "locked": true,
         "animation": {
            "duration": 1500,
            "easing": "easeInOutQuart"
         }
      };

      glmNetwork.focus(nodeID, options)
   }

   //Reverts all nodes and edges back to their original styles
   const Reset = () => {
      highlightedNodes.length = 0;
      const nodesResetMap = data.nodes.map((node) => {
         node.size = 15;
         node.hidden = false;

         return node;
      });

      const edgeItems = data.edges.map((edge) => {
         const edgeType = edge.id.split(":")[0];

         if (edge.width === 8) {
            edge.width = 2;
            edge.hidden = false;

            return edge;
         }
         else if (edgeTypes.includes(edgeType)) {
            edge.width = edgeOptions[edgeType].width;
            edge.hidden = false;

            return edge;
         }
         else {
            edge.width = 2;
            edge.hidden = false;

            return edge;
         }
      });

      data.nodes.update(nodesResetMap);
      data.edges.update(edgeItems);
      glmNetwork.fit();
      counter = -1;
   }

   /**
   * Turns phyics on or off
   * @param {bool} toggle - True turns on physics, false turns off physics
   */
   const TogglePhysics = (toggle) => {
      if (toggle) 
         glmNetwork.setOptions({physics: {enabled: true}});
      else
         glmNetwork.setOptions({physics: {enabled: false}});
   }

   /**
   * Generates an array of highlighted nodes and focuses on a node
   * starting at the end of the array then moves down every function call
   */
   const Prev = () => {
      counter--;

      //if the counter ends up less than 0 the counter starts over at the end of the array
      if (counter < 0) {
         counter = highlightedNodes.length - 1;
      }
   
      try {
         glmNetwork.focus(highlightedNodes[counter], {"scale": 3, "animation": true})
      } catch {
         alert("There are no highlighted nodes to cycle through...");
      }
   }

   /**
   * Generates an array of highlighted nodes and focuses on a node 
   * starting at the beginning of the array then moves up by one every function call
   */
   const Next = () => {
      // starting counter is -1 so that when adding one is 0 to start at index 0
      counter++;

      // if the counter matches the length of the array then the count starts back at 0
      if (counter === highlightedNodes.length) {
         counter = 0;
      }

      try {
         glmNetwork.focus(highlightedNodes[counter], {"scale": 3, "animation": true})
      } catch {
         alert("There are no highlighted nodes to cycle through...");
      }
   }

   /* ------------------------ Highlight a group of nodes and/or edges ------------------------ */
   /**
   * Grays out all edges and nodes that dont mach the node type
   * @param {string} nodeType - The type of nodes to highlight 
   */
   const HighlightGroup = (nodeType) => {
      const nodesMap = data.nodes.map((node) => {
         if (highlightedNodes.includes(node.id) || (node.group !== nodeType && node.size === 1)) {
            return node;
         }
         else if (node.group !== nodeType && !highlightedNodes.includes(node.id)) {
            node.size = 1;
            return node;
         }
         else if (node.group === nodeType && !highlightedNodes.includes(node.id)) {
            if (node.size === 1) node.size = 15;
            highlightedNodes.push(node.id);
            return node;
         }
      });
      
      const edgesMap = data.edges.map((edge) => {
         if (edge.width !== 8) {
            edge.width = 0.01;
         }

         return edge;
      });

      data.nodes.update(nodesMap);
      data.edges.update(edgesMap);
   }

   /* ------------------------ Highlight Edges ------------------------ */
   /**
   * Grays out the edges and nodes but the edges that are of the passed edge type
   * @param {string} edgeType - The type of edges to highlight
   */
   const HighlightEdges = (edgeType) => {
      if (highlightedNodes.length === 0) {
         const nodeItems = data.nodes.map((node) => {
            node.size = 1;
            return node;
         });

         data.nodes.update( nodeItems );
      }
      
      const edgeItems = data.edges.map((edge) => {
         if (edge.id.split(":")[0] === edgeType) {
            edge.width = 8;
            return edge;
         }
         else if (edge.width !== 8) {
            edge.width = 0.001;
            return edge;
         }
         return edge;
      });
      
      data.edges.update( edgeItems );
   }

   /* ------------------------ Establish Network ------------------------ */

   setGraphData(dataToVis);

   console.log(data.nodes.get());
   console.log(options.layout)
   
   console.log( "Number of Nodes: " + data.nodes.length );
   console.log( "Number of Edges: " + data.edges.length );

   /**
    * Updates uploaded data with any changes.
    * Then downloads the data back to the user's computer
   */
   const Export = () => {
      Object.keys(dataToVis).forEach(( file ) => {
         dataToVis[file]["objects"].forEach((object) => {
            const objType = object.name;
            if (nodeTypes.includes(objType)) {
               object.attributes = data.nodes.get(object.attributes.name).attributes;
            }
         });
      });

      // this end point will convert the json data back to its original glm format with changes
      window.glimpseAPI.json2glm(JSON.stringify(dataToVis));
   }

   // initiate variables that reference the NodePopup child component state and set state variables
   let setCurrentNode;
   let setOpenNodePopup;
   /**
   * Used to send the set state function from the child to the parent
   * @param {React.Dispatch<React.SetStateAction<{}>>} setChildCurrentNode - The useState function of the NodePopup child component
   * @param {React.Dispatch<React.SetStateAction<false>>} setOpen - Used to display the node popup form
   */
   const onChildMount = (setChildCurrentNode, setOpen) => {
      setCurrentNode = setChildCurrentNode;
      setOpenNodePopup = setOpen;
   }
   
   // initiate variables that reference the context menu child component state and set state variables
   let contextMenuData;
   let setContextMenuData;
   /**
    * Takes the state variables of the EdgeContextMenu component so that the parent component may change the state of the child
    * @param {Object} contextMenuDataState - Null or holds x and y data for placing the context menu on the page with the data of the selected edge
    * @param {React.Dispatch<React.SetStateAction<*>>} setContextMenuDataState - Sets the state of the child context menu component  
    */
   const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   }

   /** close the node pupup component */
   const closePopUp = () => {
      setOpenNodePopup(false);
   }

   /**
    * Updates the nodes's hover title with the new attributes
    * @param {Object} selectedNode - The node object that was selected to be edited
   */
   const saveEdits = ( selectedNode ) => {
      selectedNode.title = getTitle( selectedNode.attributes );
      data.nodes.update( selectedNode );
      setOpenNodePopup(false);
   }

   /**
    * Hide a specific edge
    * @param {string} edgeID - The ID of an edge to hide 
   */
   const hideEdge = (edgeID) => {
      const edgeToHide = data.edges.get(edgeID);
      edgeToHide.hidden = true;
      data.edges.update(edgeToHide);
   }
  
   /**
    * Hide all edges of a type
    * @param {string} edgeType - The type of edges to hide like: "overhead_line" 
    */
   const hideEdges = (edgeType) => {
      const edgesToHide = data.edges.get().map(e => {
         if (e.id.includes(edgeType)) {
            e.hidden = true;
         }
         return e;
      });
      data.edges.update(edgesToHide);
   }
  
   /**
    * Sets the x and y for the context menu component
    * @param {Event} e 
    */
   const handleContextmenu = (e) => {
      e.preventDefault();
      if (contextMenuData !== null) {
         setContextMenuData({
            ...contextMenuData,
            "mouseX": e.pageX + 2,
            "mouseY": e.pageY + 6
         });
      }
      else {
         setContextMenuData(null);
      }
   }

   /**
    * Hide edges or nodes of certain types
    * @param {string} objectType - the type of node or edge like "load" or "overhead_line"
    * @param {string} type - "node" or "edge"
    */
   const hideObjects = (objectType, type) => {
      if (type === "node") {
         const nodesToHide = data.nodes.get().map( node => {
            if (node.group === objectType) {
               node.hidden = true;
            }
            return node;
         });
         data.nodes.update(nodesToHide);
      }
      else if (type === "edge") {
         const edgesToHide = data.edges.get().map( edge => {
            if (edge.id.includes(objectType)) {
               edge.hidden = true;
            }
            return edge;
         });
         data.edges.update(edgesToHide);
      }
   }

   const showAttributes = (show) => {
      if (!show) {
         data.nodes.update(data.nodes.map((node) => {
            node.label = node.id;
            return node;
         }));

         data.edges.update(data.edges.map((edge) => {
            edge.label = " ";
            return edge;
         }));
      }
      else {
         data.nodes.update(data.nodes.map((node) => {
            node.label = getHtmlLabel(node.id, node.attributes);
            return node;
         }));

         data.edges.update(data.edges.map((edge) => {
            edge.label = getHtmlLabel(edge.id, edge.attributes);
            return edge;
         }));
      }
   }

   /**
   * @param {Object} fileData - Should Contain the file's name with extension and the file's data
   * @param {string} filename - Name of the file
   * @param {Object} data - the json data of the uploaded file 
   */
   const setCommunicationNetwork = ({filename, fileData}) => {
      const microgrids = fileData.microgrid;

      const types = [
         "node",
         "load",
         "switch",
         "inverter",
         "capacitor",
         "regulator",
         "diesel_dg",
      ];

      for (const microgrid of microgrids) {
         data.nodes.add({
            id: microgrid.name,
            label: microgrid.name,
            group: "microgrid"
         })

         objectTypeCount.nodes.microgrid++;

         for (const type of Object.keys(microgrid)) {
            if (types.includes(type)) {
               microgrid[type].forEach((nodeID) => {
                  data.edges.add({
                     id: `parentChild:${microgrid.name}-${nodeID}`,
                     from: microgrid.name,
                     to: nodeID,
                     color: {inherit: true},
                     width: 0.15
                  });
               });

               objectTypeCount.edges.parentChild++;
            }
         }
      }

      setLegendData(getLegendData(objectTypeCount));
   }

   window.glimpseAPI.onShowAttributes(showAttributes);
   window.glimpseAPI.onExportTheme(() => window.glimpseAPI.exportTheme(JSON.stringify(theme, null, 3)));

   const container = useRef(null);
   const toggleLegendRef = useRef(null);
   const showLegendStateRef = useRef(null);
   useEffect(() => {

      //if Nodes and edges have x and y coordinates load the network
      //without displaying the circular progess bar 
      if (Object.keys(data.nodes.get()[0]).includes("x") && Object.keys(data.nodes.get()[0]).includes("y")) {
         options.physics.stabilization.enabled = false;
         document.getElementById("circularProgress").style.display = "none";
         glmNetwork = new Network(container.current, data, options);
         glmNetwork.setOptions({groups: theme.groups});
         glmNetwork.setOptions({physics: {enabled: false}});
      }
      else { 
         if (data.nodes.length > 151) {
            options.edges.smooth.type = "continuous";
            options.physics.barnesHut.gravitationalConstant = -80000;
            options.physics.barnesHut.springConstant = 0.35;
            options.physics.barnesHut.springLength = 250;
         }

         // create network
         glmNetwork = new Network(container.current, data, options);
         glmNetwork.setOptions({groups: theme.groups});

         glmNetwork.on("stabilizationProgress", (params) => {
            /* Math for determining the radius of the circular progress bar based on the stabilization progress */
            const maxWidth = 360;
            const minWidth = 1;
            const widthFactor = params.iterations / params.total;
            const width = Math.max(minWidth, maxWidth * widthFactor);
            document.getElementById("circularProgress").style.background = `conic-gradient(#b25a00 ${width}deg, #333 0deg)`;
            document.getElementById("progressValue").innerText = Math.round(widthFactor * 100) + "%";
         });
         
         glmNetwork.once("stabilizationIterationsDone", () => {
            glmNetwork.setOptions({"edges": {"hidden": false}})
            /* Once stabilization is done the circular progress with display 100% for half a second then hide */
            document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 360deg, #333 0deg)";
            document.getElementById("progressValue").innerText = "100%";
            document.getElementById("circularProgress").style.opacity = 0.7;
            
            /* set physics to false for better performance when stabalization is done */
            glmNetwork.setOptions({physics: {enabled: false}})

            setTimeout(() => {
               document.getElementById("circularProgress").style.display = "none";
            }, 500);
         });
      }

      glmNetwork.on("doubleClick", (params) => {
         if (params.nodes[0] === undefined) {
            alert("Double click on a node to edit.");
         }
         else {
            /* Set the state of the NodePopup component for editing of the selected node's attributes */
            setCurrentNode(data.nodes.get(params.nodes[0]));
            setOpenNodePopup(true);
         }
      });

      /* Display the child Context menu component to hide an edge or edge types */
      glmNetwork.on("oncontext", (params) => {
         let edgeID = null;
         if (glmNetwork.getEdgeAt(params.pointer.DOM) !== undefined) {
            edgeID = glmNetwork.getEdgeAt(params.pointer.DOM);
            setContextMenuData({"edgeID": edgeID});
         }
      })
   });

   return (
      <>
         <ActionBar
            graphDataObj = {GLIMPSE_OBJECT}
            nodesDataObj = {data.nodes}
            physicsToggle = {TogglePhysics}
            reset = {Reset}
            onFind = {NodeFocus}
            prev = {Prev}
            next = {Next}
            download = {Export}
            addGraphOverlay = {setCommunicationNetwork}
            nodeIDs = {data.nodes.getIds()}
            toggleLegendRef = {toggleLegendRef}
            showLegendStateRef = {showLegendStateRef}
         />

         <NodePopup 
            onMount = {onChildMount} 
            onSave = {saveEdits} 
            onClose = {closePopUp}
         />

         <div id="networks-wrapper">
         <div
            id="graph"
            className="main-network"
            onContextMenu={handleContextmenu}
            ref={container}
         />

         <EdgeContextMenu
            onMount = {onContextMenuChildMount} 
            hideEdge = {hideEdge}
            hideEdges = {hideEdges}
         />

         <div id="circularProgress">
            <span id="progressValue">0%</span>
         </div>

         <Legend 
            findGroup = {HighlightGroup} 
            findEdges = {HighlightEdges}
            hideObjects = {hideObjects}
            legendData = {getLegendData(objectTypeCount)}
            onMount={legendMount}
            setShowLegendRef={toggleLegendRef}
            legendStateRef={showLegendStateRef}
         />
         </div>
      </>
   );
}

export default Graph;