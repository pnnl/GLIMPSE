import React, { useEffect, useRef} from "react";
import { Box, Stack } from "@mui/material"
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import ActionBar from "./ActionBar";
import NodePopup from "./NodePopup";
import "./styles/vis-network.css";
import "./styles/Graph.css";
import Legend from "./Legend";
import ContextMenu from "./ContextMenu";
import NewNodeForm from "./NewNodeForm";
const {graphOptions} = JSON.parse(await window.glimpseAPI.getConfig());
/**
* Converts an object of attributes from a node or edge to a string to be displayed
* @param {Object} attributes - an object 
* @returns {string}
*/
const getTitle = (attributes) => {
   const title = [];

   for (let [key, val] of Object.entries(attributes)) {
      title.push(`${key}: ${val}`);
   }

   return title.join("\n");
}

const getHtmlLabel = (id, attributes) => {
   return (
      `\t<b>${id}</b>\n\n` + getTitle(attributes)
   )
}

const getRandomColor = () => {
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

const Graph = ({ dataToVis, theme, isGlm}) => {
   const container = useRef(null);
   const toggleLegendRef = useRef(null);
   const showLegendStateRef = useRef(null);

   const GLIMPSE_OBJECT = {"objects": []};
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const edgeOptions = theme.edgeOptions;
   let glmNetwork = null; // global network varibale
   let counter = -1; // coutner to navigate through highlighted nodes
   let highlightedNodes = [];

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
         x_increment = 675 / currentNodeTypes.length;
      else 
         x_increment = 1450 / currentNodeTypes.length;

      let farthest_x = 0;
      let current_x = 0;
      let current_y = 0;
      let rowNodeCount = 0;

      for (let nodeType of currentNodeTypes) {
         if (legendData.nodes.length === 0) {

            if (nodeType in theme.groups) {
               legendData.nodes.add({
                  id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
                  label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
                  size: 25,
                  color: theme.groups[nodeType].color,
                  shape: theme.groups[nodeType].shape,
                  image: theme.groups[nodeType].image,
                  group: nodeType,
                  title: "Double Click to Highlight !",
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
               title: "Double Click to Highlight !",
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

         if (nodeType in theme.groups) {
            legendData.nodes.add({
               id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
               label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
               size: 25,
               color: theme.groups[nodeType].color,
               shape: theme.groups[nodeType].shape,
               image: theme.groups[nodeType].image,
               group: nodeType,
               title: "Double Click to Highlight !",
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
            title: "Double Click to Highlight !",
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

         if (type in edgeOptions) {
            legendData.edges.add({
               id: type,
               from: `${type}:${index}`,
               to: `${type}:${index + 1}`,
               title: "Double Click to Highlight !",
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
               title: "Double Click to Highlight !",
               width: 8,
            });
         }

         current_y += 65;
      });

      return legendData;
   }

   // data object that holds a DataSet for nodes and edges
   const data = {
      "nodes": new DataSet(),
      "edges": new DataSet()
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
            const nameForObjType = keys.find(key => key in obj);
            const objectType = obj[nameForObjType];
            const nameForObjID = keys.find(key => key in attributes);

            const nodeID = attributes[nameForObjID];
            
            if (nodeTypes.includes(objectType)) {
               if ("x" in attributes && "y" in attributes) {
                  objectTypeCount.nodes[objectType]++;
                  
                  if (!("elemetType" in obj))
                     GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
                  else
                     GLIMPSE_OBJECT.objects.push(obj);
                     
                  if (!("color" in theme.groups[objectType]))
                     theme.groups[objectType].color = getRandomColor();

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
               else if ("level" in attributes) {
                  if (!graphOptions.layout.hierarchical.enabled)
                     graphOptions.layout.hierarchical.enabled = true;
      
                  if (objectType in objectTypeCount.nodes)
                     objectTypeCount.nodes[objectType]++;
                  else
                     objectTypeCount.nodes[objectType] = 1;
   
                  if (!("elemetType" in obj))
                     GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
                  else
                     GLIMPSE_OBJECT.objects.push(obj);

                  if (!("color" in theme.groups[objectType]))
                     theme.groups[objectType].color = getRandomColor();

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
               
               if (!("elemetType" in obj))
                  GLIMPSE_OBJECT.objects.push({...obj, elementType: "node"});
               else
                  GLIMPSE_OBJECT.objects.push(obj);

               if (!("color" in theme.groups[objectType]))
                  theme.groups[objectType].color = getRandomColor();

               return ({
                  "id": nodeID,
                  "label": nodeID,
                  "elementType": "node",
                  "attributes": attributes,
                  "group": objectType,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
               });
               
            }
            else if ("elementType" in obj && obj.elementType === "node") {

               if (!(objectType in theme.groups)){
                  theme.groups[objectType] = {
                     "color": getRandomColor(),
                     "shape": "dot"
                  };
               }
               
               if(!nodeTypes.includes(objectType))
                  nodeTypes.push(objectType);

               if (objectType in objectTypeCount.nodes)
                  objectTypeCount.nodes[objectType]++;
               else
                  objectTypeCount.nodes[objectType] = 1;

               GLIMPSE_OBJECT.objects.push(obj);

               return ({
                  "id": nodeID,
                  "label": nodeID,
                  "elementType": "node",
                  "level": "level" in attributes ? attributes.level : undefined,
                  "attributes": attributes,
                  "group": objectType,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
               });
            }

            return obj;
         });
      
         data.nodes.add(newObjs.filter(obj => obj.elementType === "node"));
      }

      for (const file of files) {
         const objs = file.objects;

         const newObjs = objs.map((obj) => {
            const attributes = obj.attributes;
            const nameForObjType = keys.find(key => Object.keys(obj).includes(key));
            const objectType = obj[nameForObjType];
            const nameForObjID = keys.find(key => Object.keys(attributes).includes(key));

            if (nodeTypes.includes(objectType) && "parent" in attributes) {
               const nodeID = attributes[nameForObjID];
               const parent = attributes.parent;

               objectTypeCount.edges.parentChild++;

               GLIMPSE_OBJECT.objects.push({
                  "objectType": "parentChild",
                  "elementType": "edge",
                  "attributes": {
                     "id": `${parent}-${nodeID}`,
                     "from": parent,
                     "to": nodeID
                  }
               });

               return ({
                  "id": `${parent}-${nodeID}`,
                  "from": parent,
                  "to": nodeID,
                  "elementType": "edge",
                  "type": "parentChild",
                  "width": 2,
                  "attributes": {"to": parent, "from": nodeID},
                  "title": getTitle({"objectType": "parentChild", "to": parent, "from": nodeID}),
                  "color": {"inherit": true}
               });
            }
            else if (edgeTypes.includes(objectType)) {  
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = attributes[nameForObjID];

               objectTypeCount.edges[objectType]++;

               obj = renameKeys({name: "objectType"}, obj);
               obj.attributes = renameKeys({name: "id"}, obj.attributes);

               GLIMPSE_OBJECT.objects.push({...obj, "elementType": "edge"});

               return ({
                  "id": edgeID,
                  "from": edgeFrom,
                  "to": edgeTo, 
                  "elementType": "edge",
                  "type": objectType,
                  "attributes": attributes,
                  // "length": "length" in attributes ? attributes.length : undefined,
                  "color": edgeOptions[objectType].color,
                  "width": edgeOptions[objectType].width,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
               });
            }
            else if ("elementType" in obj && obj.elementType === "edge") {
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = attributes[nameForObjID];

               if (!(objectType in edgeOptions))
                  edgeOptions[objectType] = {"color": getRandomColor()};

               if (objectType in objectTypeCount.edges)
                  objectTypeCount.edges[objectType]++;
               else
                  objectTypeCount.edges[objectType] = 1;

               GLIMPSE_OBJECT.objects.push(obj);
               
               return ({
                  "id": edgeID,
                  "from": edgeFrom,
                  "to": edgeTo,
                  "elementType": "edge",
                  "type": objectType,
                  "attributes": attributes,
                  "color": edgeOptions[objectType].color,
                  "width": 2,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
               });
            }

            return obj;
         });
      
         data.edges.add(newObjs.filter(obj => obj.elementType === "edge"));
      }
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
         delete node.size;
         delete node.color;
         delete node.shape;
         node.hidden = false;
         node.label = node.id;

         return node;
      });

      const edgeItems = data.edges.map((edge) => {
         const edgeType = edge.type;

         if (edge.width === 8) {
            edge.width = "width" in edgeOptions[edgeType] ? edgeOptions[edgeType].width : 2;
            edge.hidden = false;

            return edge;
         }
         else if (edgeTypes.includes(edgeType) || edgeType in edgeOptions) {
            edge.width = "width" in edgeOptions[edgeType] ? edgeOptions[edgeType].width : 2;
            edge.color = edgeOptions[edgeType].color;
            edge.hidden = false;

            return edge;
         }
         else {
            edge.color = {"inherit": true};
            edge.width = 0.15;
            edge.hidden = false;

            return edge;
         }
      });

      glmNetwork.setOptions({"groups": theme.groups});
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
         glmNetwork.focus(highlightedNodes[counter], {
            "scale": 3,
            "animation": {
               "duration": 750
            }, 
            "easingFunction": "easeInQuad"
         });
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
         glmNetwork.focus(highlightedNodes[counter], {
            "scale": 3,
            "animation": {
               "duration": 750
            }, 
            "easingFunction": "easeInQuad"
         });
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
      data.nodes.update(data.nodes.map((node) => {
         if (node.group === nodeType && highlightedNodes.includes(node.id)) {
            node.shape = "dot";
            node.size = 10;
            node.color = "rgba(200, 200, 200, 0.5)";
            node.label = " ";
            
            highlightedNodes = highlightedNodes.filter(nodeid => nodeid !== node.id);
            return node;
         }
         else if (node.group !== nodeType && !highlightedNodes.includes(node.id)) {
            node.shape = "dot";
            node.size = 10;
            node.color = "rgba(200, 200, 200, 0.5)";
            node.label = " ";
            return node;
         }
         else if (node.group === nodeType && !highlightedNodes.includes(node.id)) {
            if (node.shape === "dot") {
               delete node.color;
               delete node.shape;
               delete node.size;
               node.label = node.id;
            }

            highlightedNodes.push(node.id);
            return node;
         }

         return node;
      }));
      
      data.edges.update(data.edges.map((edge) => {
         if (edge.width !== 8) {
            edge.width = 0.15;
            edge.color = "rgba(200, 200, 200, 0.5)";
         }

         return edge;
      }));
   }

   /* ------------------------ Highlight Edges ------------------------ */
   /**
   * Grays out the edges and nodes but the edges that are of the passed edge type
   * @param {string} edgeType - The type of edges to highlight
   */
   const HighlightEdges = (edgeType) => {
      if (highlightedNodes.length === 0) {
         const nodeItems = data.nodes.map((node) => {
            node.shape = "dot"
            node.size = 10;
            node.color = "rgba(200,200,200,0.5)";
            node.label = " ";
            return node;
         });

         data.nodes.update( nodeItems );
      }

      const edgeItems = data.edges.map((edge) => {
         if (edge.type === edgeType && edge.width === 8) {
            edge.width = 0.15;
            edge.color = "rgba(200,200,200,0.5)";
            return edge;
         }
         else if (edge.type === edgeType) {
            edge.width = 8;
            edge.color = edgeOptions[edge.type].color;
            return edge;
         }
         else if (edge.width !== 8) {
            edge.width = 0.15;
            edge.color = "rgba(200,200,200,0.5)";
            return edge;
         }
         return edge;
      });
      
      data.edges.update( edgeItems );
   }

   /* ------------------------ Establish Network ------------------------ */

   setGraphData(dataToVis);
   
   console.log( "Number of Nodes: " + data.nodes.length );
   console.log( "Number of Edges: " + data.edges.length );

   /**
    * Updates uploaded data with any changes.
    * Then downloads the data back to the user's computer
   */
   const Export = () => {
      if (isGlm) {
         Object.keys(dataToVis).forEach((file) => {
            dataToVis[file].objects.forEach((obj) => {
               if ("attributes" in obj && data.nodes.getIds().includes(obj.attributes.name)) {
                  obj.attributes = data.nodes.get(obj.attributes.name).attributes;
               }
            });
         });

         window.glimpseAPI.json2glm(JSON.stringify(dataToVis));
      }
      else {
         alert("Export feature available for .glm uploads for now");
      }
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
    * Takes the state variables of the ContextMenu component so that the parent component may change the state of the child
    * @param {Object} contextMenuDataState - Null or holds x and y data for placing the context menu on the page with the data of the selected edge
    * @param {React.Dispatch<React.SetStateAction<*>>} setContextMenuDataState - Sets the state of the child context menu component  
    */
   const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   }

   let newNodeFormSetState;
   const onNewNodeFormMount = (setOpenNewNodeForm) => {
      newNodeFormSetState = setOpenNewNodeForm;
   }

   const openNewNodeForm = (openFormBool) => {
      newNodeFormSetState(openFormBool);
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
      const edgesToHide = data.edges.get().map((edge) => {
         if (edge.type === edgeType) {
            edge.hidden = true;
         }
         return edge;
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
            "mouseX": e.clientX + 2,
            "mouseY": e.clientY + 6
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

      console.log(objectType, type);
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
            if (edge.type === objectType) {
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
      const communication_nodes = fileData.communication_nodes;

      const types = [
         "node",
         "load",
         "switch",
         "inverter",
         "capacitor",
         "regulator",
         "diesel_dg",
         "microgirds",
         "communication_node"
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
                     type: type,
                     width: 0.15
                  });
               });

               objectTypeCount.edges.parentChild++;
            }
         }
      }

      for (const comm_node of communication_nodes) {
         data.nodes.add({
            id: comm_node.name,
            label: comm_node.name,
            group: "communication_node"
         })

         objectTypeCount.nodes.communication_node++;

         for (const type of Object.keys(comm_node)) {
            if (types.includes(type)) {
               comm_node[type].forEach((nodeID) => {
                  data.edges.add({
                     id: `parentChild:${comm_node.name}-${nodeID}`,
                     from: comm_node.name,
                     to: nodeID,
                     type: type,
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

   /**
    * Create and visualize a new node in either CIM or GLM model
    * @param {Object} newNodeObj - contains the new values from each field in the new node form 
    * @param {number} newNodeObj.nodeType - The index of the node type in the nodeTypes list
    * @param {string} newNodeObj.nodeID - The ID for the new node
    * @param {string} newNodeObj.connectTo - The ID of an existing Node to connect the new node
    * @param {number} newNodeObj.edgeType - The index of the edge type in the edgeTypes list
   */
   const addNewNode = ({nodeType, nodeID, connectTo, edgeType}) => {
      const node_types = Object.keys(objectTypeCount.nodes).filter((key) => objectTypeCount.nodes[key] > 0);
      const edge_types = Object.keys(objectTypeCount.edges).filter((key) => objectTypeCount.edges[key] > 0);

      try {

         const nodesOfsameType = data.nodes.get().filter(n => n.group === node_types[nodeType])
         
         const [addedNodeID] = data.nodes.add({
            "id": `${node_types[nodeType]}_${nodeID}`,
            "label": `${node_types[nodeType]}_${nodeID}`,
            "group": node_types[nodeType],
            "level": "level" in nodesOfsameType[0].attributes ? nodesOfsameType[0].attributes.level : undefined
         });
   
         const title = getTitle(data.nodes.get(addedNodeID));
         const addedNode = data.nodes.get(addedNodeID);
         addedNode.title = title;
         data.nodes.update(addedNode);
   
         const [addedEdgeID] = data.edges.add({
            "id": `${connectTo}-${addedNodeID}`,
            "from": connectTo,
            "to": addedNodeID,
            "type": edge_types[edgeType],
            "color": edgeOptions[edge_types[edgeType]].color,
            "width": edgeOptions[edge_types[edgeType]].width
         });
   
         const {color, width, ...rest} = data.edges.get(addedEdgeID);
         const addedEdge = data.edges.get(addedEdgeID);
         addedEdge.title = `Object Type: ${edge_types[edgeType]}\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
      } 
      catch (err) {
         alert(`${node_types[nodeType]}_${nodeID} already exists...`);
      }
   }

   const deleteNode = (nodeID) => {
      data.nodes.remove(nodeID);
      
      const edgesToDelete = [];
      for (let edge of data.edges.get()) {
         if (edge.from === nodeID || edge.to === nodeID)
            edgesToDelete.push(edge.id);
      }
      
      data.edges.remove(edgesToDelete);
   }

   const toggleVisOptions = () => {
      const layoutForm = document.getElementById("layout-form");

      console.log(layoutForm);

      if (layoutForm.style.display === "none" || layoutForm.style.display === "") {
         layoutForm.style.display = "flex";
         toggleLegendRef.current(false);
      }
      else {
         if (document.getElementById("graph").style.width === "100%") {
            document.getElementById("graph").style.width = "70%"
         }
         layoutForm.style.display = "none";
         toggleLegendRef.current(true);
      }
   }

   const updateNode = (updateData) => {
      const updateDataStream = JSON.parse(updateData);

      if (updateDataStream.elementType === "node") {
         const node = data.nodes.get(updateDataStream.id);
         data.nodes.update({...node, ...updateDataStream.updates});
      }
      else {
         const edge = data.edges.get(updateDataStream.id);
         data.edges.update({...edge, ...updateDataStream.updates});
      }
   }

   useEffect(() => {
      const removeListenerArr = [];
      removeListenerArr.push(window.glimpseAPI.onShowVisOptions(toggleVisOptions));
      removeListenerArr.push(window.glimpseAPI.onExtract(Export));
      removeListenerArr.push(window.glimpseAPI.onShowAttributes(showAttributes));
      removeListenerArr.push(window.glimpseAPI.onExportTheme(() => window.glimpseAPI.exportTheme(JSON.stringify(theme, null, 3))));
      removeListenerArr.push(window.glimpseAPI.onUpdateData(updateNode));

      return () => {
         for (let removeListener of removeListenerArr) {
            removeListener();
         }

         graphOptions.physics.solver = "barnesHut";
         graphOptions.layout.hierarchical.enabled = false;
      };
   }, []);

   useEffect(() => {
      if ("x" in data.nodes.get()[0] && "y" in data.nodes.get()[0]) {
         graphOptions.physics.stabilization.enabled = false;
         graphOptions.physics.enabled = false;
         graphOptions.groups = theme.groups;
         document.getElementById("circularProgress").style.display = "none";
         glmNetwork = new Network(container.current, data, graphOptions);
      }
      else {
         if (data.nodes.length > 151 && data.nodes.length <= 300 && data.edges.length >= 7000) {
            graphOptions.physics.solver = "forceAtlas2Based";
            // graphOptions.nodes.scaling.max = 100;
            // graphOptions.nodes.scaling.label.max = 90;
            
         }
         else if (data.nodes.length > 300 && data.edges.length < 7000) {            
            // graphOptions.physics.solver = "forceAtlas2Based";
            graphOptions.physics.barnesHut.gravitationalConstant = -80000;
            graphOptions.physics.barnesHut.springConstant = 0.85;
            graphOptions.physics.barnesHut.centralGravity = 0.1;
            graphOptions.physics.barnesHut.springLength = 105;
            graphOptions.physics.barnesHut.avoidOverlap = 0.6;
            graphOptions.physics.barnesHut.damping = 0.18;
            // graphOptions.nodes.scaling.max = 100;
            // graphOptions.nodes.scaling.label.max = 90;
         }

         // create network
         graphOptions.groups = theme.groups;
         glmNetwork = new Network(container.current, data, graphOptions);
         
         // data.nodes.update(data.nodes.get().map((node) => {
         //    node.value = glmNetwork.getConnectedEdges(node.id).length;
         //    return node;
         // }));
         

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
            /* Once stabilization is done the circular progress with display 100% for half a second then hide */
            document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 360deg, #333 0deg)";
            document.getElementById("progressValue").innerText = "100%";
            document.getElementById("circularProgress").style.opacity = 0.7;
            
            /* set physics to false for better performance when stabalization is done */
            glmNetwork.setOptions({physics: {enabled: false}});

            // data.nodes.update(data.nodes.get().map((node) => {
            //    node.value = undefined;
            //    return node;
            // }));

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
         if (glmNetwork.getEdgeAt(params.pointer.DOM) !== undefined && glmNetwork.getNodeAt(params.pointer.DOM) === undefined) {
            setContextMenuData({"edgeID": glmNetwork.getEdgeAt(params.pointer.DOM)});
         }
         else if (glmNetwork.getNodeAt(params.pointer.DOM) !== undefined) {
            setContextMenuData({"nodeID": glmNetwork.getNodeAt(params.pointer.DOM)});
         }
         else {
            setContextMenuData({});
         }
      });

      glmNetwork.setOptions({
         "configure": {
            "filter": (option, path) => {
               if (path.indexOf("physics") !== -1)
                  return true;
               if (path.indexOf("smooth") !== -1 || option === "smooth")
                  return true;

               return false;
            },
            "container": document.getElementById("layout-form")
         }
      });

   }, []);

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

         <NewNodeForm
            onMount={onNewNodeFormMount}
            nodes={data.nodes.getIds()}
            addNode = {addNewNode}
            nodeTypes={Object.keys(objectTypeCount.nodes).filter((key) => objectTypeCount.nodes[key] > 0)}
            edgeTypes={Object.keys(objectTypeCount.edges).filter((key) => objectTypeCount.edges[key] > 0)}
         />

         <div id="circularProgress">
            <span id="progressValue">0%</span>
         </div> 

         <ContextMenu
            onMount = {onContextMenuChildMount} 
            hideEdge = {hideEdge}
            hideEdges = {hideEdges}
            openNewNodeForm={openNewNodeForm}
            deleteNode={deleteNode}
         />

         <Box 
            component={"div"}
            sx={{"width":"100%", "height": "calc(100vh - 116px)"}}
         >
         <Stack sx={{"height":"100%", "width": "100%", "borderTop": "1px solid lightgrey"}} direction={"row"}>
            <Box
               id="graph"
               component={"div"}
               sx={{"width": "70%","height": "100%"}} 
               ref={container}
               onContextMenu={handleContextmenu}
            />

            <div id="layout-form"/>

            <Legend
               findGroup = {HighlightGroup}
               findEdges = {HighlightEdges}
               hideObjects={hideObjects}
               legendData = {getLegendData(objectTypeCount)}
               onMount={legendMount}
               setShowLegendRef={toggleLegendRef}
               legendStateRef={showLegendStateRef}
            />
         </Stack>
         </Box>
      </>
   );
}

export default Graph;