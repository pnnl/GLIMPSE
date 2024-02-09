import React, { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import { v4 } from "uuid";
import ActionBar from "./ActionBar";
import NodePopup from "./NodePopup";
import "./styles/vis-network.css";
import "./styles/Graph.css";
import Legend from "./Legend";
import GraphContextMenu from "./GraphContextMenu";
import NewNodeForm from "./NewNodeForm";
import appConfig from "./config/appConfig.json";
const legendEdgeOptions = appConfig.legendEdgeOptions;
const edgeOptions = appConfig.edgeOptions;

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

   let x_increment;

   if (currentNodeTypes.length < 6)
      x_increment = 800 / currentNodeTypes.length;
   else 
      x_increment = 1000 / currentNodeTypes.length;

   let farthest_x = 0;
   let current_x = 0;
   let current_y = 0;
   let rowNodeCount = 0;

   for (let nodeType of currentNodeTypes) {
      
      if (legendData.nodes.length === 0) {
         legendData.nodes.add({
            id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
            label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
            group: nodeType,
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

      legendData.nodes.add({
         id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
         label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
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
         x: 0,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "black"
      });

      legendData.nodes.add({
         id: `${type}:${index + 1}`,
         x: farthest_x === 0 ? current_x : farthest_x,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "black"
      })

      legendData.edges.add({
         id: type,
         from: `${type}:${index}`,
         to: `${type}:${index + 1}`,
         label: `${type} [${typeCounts.edges[type]}]`,
         width: legendEdgeOptions[type].width,
         color: legendEdgeOptions[type].color
      });

      current_y += 65;
   });

   return legendData;
}

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

const Graph = (props) => {
   const options = appConfig.graphOptions; // get the options for the graph visualization
   let glmNetwork; // global network varibale
   let counter = -1; // coutner to navigate through highlighted nodes

   // data object that holds a DataSet for nodes and edges
   const data = {
      "nodes": new DataSet(),
      "edges": new DataSet()
   };

   const newCIMobjs = [];

   // used to keep count of each object type
   const objectTypeCount = {
      "nodes": {
         "communication_node": 0,
         "triplex_meter": 0,
         "inverter_dyn": 0,
         "triplex_load": 0, 
         "triplex_node": 0,
         "substation": 0,
         "diesel_dg": 0,
         "capacitor": 0,
         "technique": 0,
         "microgrid": 0,
         "terminal": 0,
         "location": 0,
         "c_node": 0,
         "person": 0,
         "capec": 0,
         "meter": 0,
         "load": 0,
         "node": 0,
         "cwe": 0,
         "cve": 0,
      },
      "edges": {
         "underground_line": 0,
         "series_reactor": 0,
         "overhead_line": 0,
         "triplex_line": 0,
         "transformer": 0,
         "parentChild": 0,
         "regulator": 0,
         "traveling": 0,
         "switch": 0,
         "friend": 0, 
         "line": 0
      }
   };

   const nodeTypes = appConfig.nodeTypes; //These types are recognized as nodes
   const edgeTypes = appConfig.edgeTypes; //These types are recognized as edges

   let setLegendData;
   const legendMount = (legendSetFunc) => {
      setLegendData = legendSetFunc;
   }

   /**
   * Collects all the nodes and edges with their attributes and sets it to the data variable
   * @param {Object} dataFiles 
   */
   const setGraphData = (dataFiles) => {
      const files = [];
      const keys = ["name", "objectType", "id"]; // the first key of each object must have one of these key names

      //this loop splits the json into each file name and their data to an array
      //each key of the json is the file name along with the file's data
      for (const file in dataFiles) {
         files.push(dataFiles[file]);
      }

      //For each file gather all of the nodes that matches the types
      for (const file of files) {

         const objs = file.objects;

         for (const obj of objs) {
            let name;
            Object.keys(obj).forEach((k) => {
               if (keys.includes(k)) {
                  name = k;
               }
            });

            const objectType = obj[name]; // the object type is the first key of each object
            const attributes = obj.attributes; // get the atributes of each object
            
            if (nodeTypes.includes(objectType)) { // if the object is of a node type then it is added as a node
               Object.keys(attributes).forEach((k) => {
                  if (keys.includes(k)) {
                     name = k;
                  }
               });

               const nodeID = attributes[name]; // the ID of each object is in the atributes js Object

               // if the object has x and y coordinates they will be added to the node's object datastructure
               if (Object.keys(attributes).includes("x") && Object.keys(attributes).includes("y")) {
                  data.nodes.add({
                     "id": nodeID,
                     "label": nodeID,
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

                  options.edges.smooth.roundness = 0;
                  data.nodes.add({
                     "id": nodeID,
                     "label": nodeID,
                     "level": attributes.level,
                     "attributes": attributes,
                     "group": objectType,
                     "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
                  });
               }
               else {
                  if (options.layout.hierarchical.enabled) {
                     options.layout.hierarchical.enabled = false;
                     options.physics.solver = "barnesHut";
                  }

                  data.nodes.add({
                     "id": nodeID,
                     "label": nodeID.length > 15 ? "" : nodeID,
                     "attributes": attributes,
                     "group": objectType,
                     "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
                  });
               }
               
               objectTypeCount.nodes[objectType]++;
            }
         }
      }

      // for each file gather all of the edge types and create edges between nodes
      for (const file of files) {
         const objs = file.objects;

         for (const obj of objs) {
            let name;
            let attributeName;

            Object.keys(obj).forEach((k) => {
               if (keys.includes(k)) {
                  name = k;
               }
            })

            const objectType = obj[name];
            const attributes = obj.attributes;

            Object.keys(attributes).forEach(k => {
               if (keys.includes(k)) {
                  attributeName = k;
               }
            })

            if (edgeTypes.includes(objectType)) {
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = objectType + ":" + attributes[attributeName];

               data.edges.add({
                  "id": edgeID,
                  "from": edgeFrom,
                  "to": edgeTo,
                  "attributes": attributes,
                  "color": edgeOptions[objectType].color,
                  "width": edgeOptions[objectType].width,
                  "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
               });
               
               objectTypeCount.edges[objectType]++;
            }
            else if (nodeTypes.includes(objectType)) {// some nodes have a parent attribute
               const nodeID = attributes[attributeName];
               const parent = attributes.parent;
               
               if (parent !== undefined) {
                  data.edges.add({
                     "id": `parentChild:${parent}-${nodeID}`,
                     "from": parent,
                     "to": nodeID,
                     "attributes": {"to": parent, "from": nodeID},
                     "color": {"inherit": true}
                  });

                  objectTypeCount.edges.parentChild++;
               }
            }
         }
      }
   }

   /**
   * Zooms in on a node
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

   /**
   * Reverts all nodes and edges back to their original styles
   */
   const Reset = () => {
      const nodesResetMap = data.nodes.map((node) => {
         delete node.color;
         delete node.size;
         node.hidden = false;

         return node;
      });

      const edgeItems = data.edges.map((e) => {
         const edgeType = e.id.split(":")[0];

         if (e.width === 8) {
            e.width = 2;
            e.hidden = false;
            return e;
         }
         else if (edgeTypes.includes(edgeType)) {
            e.color = edgeOptions[edgeType].color;
            e.width = edgeOptions[edgeType].width;
            e.hidden = false;
            return e;
         }
         else {
            e.color = {inherit: true};
            e.width = 0.15;
            e.hidden = false;
            return e;
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
      const options = {
         "scale": 3,
         "locked": true,
         "animation": {
            "duration": 1500,
            "easing": "easeInOutQuart"
         }
      };

      // generates an array of the current highlighted nodes
      const prev = data.nodes.get({
         filter: (n) => {
            return (n.size === 15);
         }
      });
   
      counter--;

      //if the counter ends up less than 0 the counter starts over at the end of the array
      if (counter < 0) {
         counter = prev.length - 1;
      }
   
      try {
         glmNetwork.focus(prev[counter].id, options)
      }
      catch {
         alert("There are no highlighted nodes to cycle through...");
      }
   }

   /**
   * Generates an array of highlighted nodes and focuses on a node 
   * starting at the beginning of the array then moves up by one every function call
   */
   const Next = () => {
      const options = {
         "scale": 3,
         "locked": true,
         "animation": {
            "duration": 1500,
            "easing": "easeInOutQuart"
         }
      };

      // get the array of all the highlighted nodes
      const next = data.nodes.get({
         filter: (n) => {
            return (n.size === 15);
         }
      });

      // starting counter is -1 so that when adding one is 0 to start at index 0
      counter++;

      // if the counter matches the length of the array then the count starts back at 0
      if (counter === next.length) {
         counter = 0;
         try {
            glmNetwork.focus(next[counter].id, options)
         }
         catch {
            alert("There are no highlighted nodes to cycle through...");
         }
      }
      else {
         try {
            glmNetwork.focus(next[counter].id, options)
         }
         catch {
            alert("There are no highlighted nodes to cycle through...");
         }
      }
   }

   /* ------------------------ Highlight a group of nodes and/or edges ------------------------ */
   /**
   * Grays out all edges and nodes that dont mach the node type
   * @param {string} nodeType - The type of nodes to highlight 
   */
   const HighlightGroup = (nodeType) => {
      const nodesMap = data.nodes.map((node) => {

         if (node.group === nodeType || node.size === 15) {
            delete node.color;
            node.size = 15;
            return node;
         }
         else if (node.group === nodeType && node.size === 15) {
            node.size = 1;
            node.color = "lightgrey";
            return node;
         }
      
         node.size = 1;
         node.color = "lightgrey";
         return node;
      });
      
      const edgesMap = data.edges.map((edge) => {
         if (edge.width !== 8) edge.color = "lightgrey";
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
      const nodeItems = data.nodes.map((node) => {
         if (node.size !== 15) {
            node.color = "lightgrey";
            node.size = 1;

            return node;
         }
         return node;
      });
      
      const edgeItems = data.edges.map((edge) => {
         if (edge.id.split(":")[0] === edgeType) {
            console.log(edge)
            edge.color = edgeOptions[edgeType].color;
            edge.width = 8;
            return edge;
         }
         else if (edge.width !== 8) {
            edge.color = "lightgrey";
            edge.width = 0.15;
            return edge;
         }
         return edge;
      });
      
      data.nodes.update( nodeItems );
      data.edges.update( edgeItems );
   }

   /* ------------------------ Estabilsh Network ------------------------ */

   setGraphData(props.dataToVis);
   
   console.log( "Number of Nodes: " + data.nodes.length );
   console.log( "Number of Edges: " + data.edges.length );

   /**
    * Updates uploaded data with any changes.
    * Then downloads the data back to the  user's computer as a zip folder with glm files
   */
   const Export = () => {
      if (!props.cim) {
         Object.keys(props.dataToVis).forEach(( file ) => {
            props.dataToVis[file]["objects"].forEach((object) => {

               const objType = object.name;
               if (nodeTypes.includes(objType)) {
                  const newNodeAttributes = data.nodes.get(object.attributes.name).attributes;
                  object.attributes = newNodeAttributes;
               }
            });
         });

         // this end point will convert the json data back to its original glm files with changesl
         window.glimpseAPI.json2glm(JSON.stringify(props.dataToVis));
      }

      window.glimpseAPI.export2CIM(JSON.stringify(newCIMobjs));
   }

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

   /**
   * Colses the NodePopup component
   */
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
    * Hide all edges of a certain type
    * @param {string} edgeType - The type of edges to hide like: "overhead_line" 
    */
   const hideEdges = (edgeType) => {
      const edgesToHide = data.edges.get().map((edge) => {
         if (edge.id.includes(edgeType)) {
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

      if (type === "node"){
         const nodesToHide = data.nodes.get().map((node) => {
            if (node.group === objectType) {
               node.hidden = true;
            }
            return node;
         });

         data.nodes.update(nodesToHide);
      }
      else if (type === "edge") {
         const edgesToHide = data.edges.get().map((edge) => {

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
            if(types.includes(type)) {
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

   /**
    * Create and visualize a new node in either CIM or GLM model
    * @param {Object} newNodeObj - contains the new values from each field in the new node form 
    * @param {number} newNodeObj.nodeType - The index of the node type in the nodeTypes list
    * @param {string} newNodeObj.nodeID - The ID for the new node
    * @param {string} newNodeObj.connectTo - The ID of an existing Node to connect the new node
    * @param {number} newNodeObj.edgeType - The index of the edge type in the edgeTypes list
    */
   const addNewNode = ({nodeType, nodeID, connectTo, edgeType}) => {
      if (props.cim) {
         const NEW_C_NODE_ID = v4(); // new node for new terminal
         const NEW_NODE_ID = v4(); // new terminal with type
         const TERMINAL_1_ID = v4(); // connected to the new connectivity node
         const TERMINAL_2_ID = v4(); // connected to existing connectivity node
         const newObjs = [];

         // new node
         data.nodes.add({
            id: NEW_NODE_ID,
            mRID: NEW_NODE_ID,
            name: `terminal:${nodeID}`,
            group: nodeTypes[nodeType],
            parent: NEW_C_NODE_ID
         });
         addedNode = data.nodes.get(NEW_NODE_ID);
         ({id, group, ...rest} = addedNode);
         addedNode.title = `Object Type: ${nodeTypes[nodeType]}\n${getTitle(rest)}`;
         addedNode.attributes = rest;
         data.nodes.update(addedNode);
         newObjs.push(addedNode);
         
         
         // Connectivity Node
         data.nodes.add({
            id: NEW_C_NODE_ID,
            mRID: NEW_C_NODE_ID,
            name: `c_node:${NEW_C_NODE_ID}`,
            terminals: [TERMINAL_1_ID, NEW_NODE_ID],
            group: "c_node"
         });
         let addedNode = data.nodes.get(NEW_C_NODE_ID);
         let {id, group, ...rest} = addedNode;
         addedNode.title = `Object Type: c_node\n${getTitle(rest)}`;
         addedNode.attributes = rest;
         data.nodes.update(addedNode);
         newObjs.push(addedNode);

         // connect new connectivity node with new node
         let color, width = null;
         data.edges.add({
            id: `line:${NEW_C_NODE_ID}-${NEW_NODE_ID}`,
            from: NEW_C_NODE_ID,
            to: NEW_NODE_ID,
            color: edgeOptions.line.color,
            width: edgeOptions.line.width
         });
         let addedEdge = data.edges.get(`line:${NEW_C_NODE_ID}-${NEW_NODE_ID}`);
         ({color, width, ...rest} = addedEdge)
         addedEdge.title = `Object Type: line\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
         
         // create plain terminal #1
         data.nodes.add({
            id: TERMINAL_1_ID,
            mRID: TERMINAL_1_ID,
            name: `terminal:${TERMINAL_1_ID}`,
            group: "terminal",
            parent: NEW_C_NODE_ID
         });
         addedNode = data.nodes.get(TERMINAL_1_ID);
         ({id, group, ...rest} = addedNode);
         addedNode.title = `Object Type: terminal\n${getTitle(rest)}`;
         addedNode.attributes = rest;
         data.nodes.update(addedNode);
         newObjs.push(addedNode);
         
         // connect terminal 1 with new connectivity node
         data.edges.add({
            id: `line:${NEW_C_NODE_ID}-${TERMINAL_1_ID}`,
            from: NEW_C_NODE_ID,
            to: TERMINAL_1_ID,
            color: edgeOptions.line.color,
            width: edgeOptions.line.width
         });
         addedEdge = data.edges.get(`line:${NEW_C_NODE_ID}-${TERMINAL_1_ID}`);
         ({color, width, ...rest} = addedEdge);
         addedEdge.title = `Object Type: line\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
         
         // terminal #2
         data.nodes.add({
            id: TERMINAL_2_ID,
            mRID: TERMINAL_2_ID,
            name: `terminal:${TERMINAL_2_ID}`,
            parent: connectTo,
            group: "terminal"
         });
         addedNode = data.nodes.get(TERMINAL_2_ID);
         ({id, group, ...rest} = addedNode);
         addedNode.title = `Object Type: terminal\n${getTitle(rest)}`;
         addedNode.attributes = rest;
         data.nodes.update(addedNode);
         newObjs.push(addedNode);
         
         // connect terminal #2 to existing connectivity node
         data.edges.add({
            id: `line:${connectTo}-${TERMINAL_2_ID}`,
            from: connectTo,
            to: TERMINAL_2_ID,
            color: edgeOptions.line.color,
            width: edgeOptions.line.width
         });
         addedEdge = data.edges.get(`line:${connectTo}-${TERMINAL_2_ID}`);
         ({color, width, ...rest} = addedEdge);
         addedEdge.title = `Object Type: line\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
   
         // connect terminal #2 to terminal #1 as selected edge type
         data.edges.add({
            "id": `${edgeTypes[edgeType]}:${TERMINAL_2_ID}-${TERMINAL_1_ID}`,
            "from": TERMINAL_2_ID,
            "to": TERMINAL_1_ID,
            "color": edgeOptions[edgeTypes[edgeType]].color,
            "width": edgeOptions[edgeTypes[edgeType]].width
         });
         addedEdge = data.edges.get(`${edgeTypes[edgeType]}:${TERMINAL_2_ID}-${TERMINAL_1_ID}`);
         ({color, width, ...rest} = addedEdge);
         addedEdge.title = `Object Type: ${edgeTypes[edgeType]}\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
         newObjs.push(addedEdge);

         newCIMobjs.push(newObjs);
         console.log(newCIMobjs);
      }
      else {
         const [addedNodeID] = data.nodes.add({
            "id": `${nodeTypes[nodeType]}_${nodeID}`,
            "group": nodeTypes[nodeType]
         });

         const title = getTitle(data.nodes.get(addedNodeID));
         const addedNode = data.nodes.get(addedNodeID);
         addedNode.title = title;
         data.nodes.update(addedNode);

         const [addedEdgeID] = data.edges.add({
            "id": `${edgeTypes[edgeType]}:${connectTo}-${addedNodeID}`,
            "from": connectTo,
            "to": addedNodeID,
            "color": edgeOptions[edgeTypes[edgeType]].color,
            "width": edgeOptions[edgeTypes[edgeType]].width
         });

         const {color, width, ...rest} = data.edges.get(addedEdgeID);
         const addedEdge = data.edges.get(addedEdgeID);
         addedEdge.title = `Object Type: ${edgeTypes[edgeType]}\n${getTitle(rest)}`;
         data.edges.update(addedEdge);
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

      console.log(data.edges.length);
   }

   const getConnectivityNodes = () => {
      const c_nodes = data.nodes.getIds({
         filter: (node) => {
            return (node.group === "c_node");
         }
      });
      
      return c_nodes;
   }

   window.glimpseAPI.onShowAttributes(showAttributes);

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
         glmNetwork.setOptions({physics: {enabled: false}})
      }
      else { 
         if (data.nodes.length > 200) {
            options.physics.barnesHut.gravitationalConstant = -100000;
            options.physics.barnesHut.springConstant = 0.5;
            // options.physics.barnesHut.springLength = 3;
         }

         // create network
         glmNetwork = new Network(container.current, data, options);

         glmNetwork.on("stabilizationProgress", (params) => {
            /* Math for determining the radius of the circular progress bar based on the stabilization progress */
            const maxWidth = 360;
            const minWidth = 1;
            const widthFactor = params.iterations / params.total;
            const width = Math.max(minWidth, maxWidth * widthFactor);
            document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 "+ width +"deg, #333 0deg)";
            document.getElementById("progressValue").innerText = Math.round(widthFactor * 100) + "%";
         });
         
         glmNetwork.once("stabilizationIterationsDone", () => {
            glmNetwork.setOptions({"edges": {"hidden": false}, "physics": {"enabled": false}});

            /* Once stabilization is done the circular progress with display 100% for half a second then hide */
            document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 360deg, #333 0deg)";
            document.getElementById("progressValue").innerText = "100%";
            document.getElementById("circularProgress").style.opacity = 0.7;

            setTimeout(() => {
               document.getElementById("circularProgress").style.display = "none";
            }, 500);
         });
      }

      glmNetwork.on("hoverNode", ({ node }) => {
         const currNode = data.nodes.get(node);
         currNode.label = node;
         data.nodes.update(currNode);
      });

      glmNetwork.on("blurNode", ({ node }) => {
         const currNode = data.nodes.get(node);
         if (currNode) {
            currNode.label = "";
            data.nodes.update(currNode);
         }
      });
       
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

      /* Display the child Context menu component */
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
   });

   return (
      <>
         <ActionBar
            graphDataObj={props.dataToVis}
            nodesDataObj = {data.nodes}
            physicsToggle = {TogglePhysics}
            reset = {Reset}
            onFind = {NodeFocus}
            prev = {Prev}
            next = {Next}
            download = {Export}
            addGraphOverlay = {setCommunicationNetwork}
            nodeIDs={data.nodes.getIds()}
            toggleLegendRef={toggleLegendRef}
            showLegendStateRef={showLegendStateRef}
         />

         <NodePopup 
            onMount = {onChildMount} 
            onSave = {saveEdits} 
            onClose = {closePopUp}
         />

         <NewNodeForm
            onMount={onNewNodeFormMount}
            nodes={props.cim ? getConnectivityNodes() : data.nodes.getIds()}
            addNode = {addNewNode}
         />

         <div id="networks-wrapper">
         <div
            id="graph"
            className="main-network"
            onContextMenu={handleContextmenu}
            ref={container}
         />

         <div id="circularProgress">
            <span id="progressValue">0%</span>
         </div>

         <GraphContextMenu
            onMount = {onContextMenuChildMount} 
            hideEdge = {hideEdge}
            hideEdges = {hideEdges}
            openNewNodeForm={openNewNodeForm}
            deleteNode={deleteNode}
         />

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