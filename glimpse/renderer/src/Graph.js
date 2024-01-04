import React, { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import ActionBar from "./ActionBar";
import NodePopup from "./NodePopup";
import "./styles/vis-network.css";
import "./styles/Graph.css";
import Legend from "./Legend";
import EdgeContextMenu from "./EdgeContextMenu";
import appConfig from "./config/appConfig.json";

const options = appConfig.graphOptions; // get the options for the graph visualization
const edgeOptions = appConfig.edgeOptions;
let glmNetwork; // global network varibale
let counter = -1; // coutner to navigate through highlighted nodes

// data object that holds a DataSet for nodes and edges
const data = {
  nodes: new DataSet(),
  edges: new DataSet()
};

// used to keep count of each object type
const objectTypeCount = {
   "nodes": {
      "load": 0,
      "node": 0,
      "meter": 0,
      "inverter_dyn": 0,
      "diesel_dg": 0,
      "capacitor": 0,
      "triplex_load": 0, 
      "triplex_node": 0,
      "triplex_meter": 0,
      "substation": 0
   },
   "edges": {
      "overhead_line": 0,
      "switch": 0, 
      "underground_line": 0,
      "series_reactor": 0,
      "triplex_line": 0,
      "regulator": 0,
      "transformer": 0,
      "parentChild": 0,
      "line": 0
   }
};

//These types are recognized as nodes
const nodeTypes = appConfig.nodeTypes;
//These types are recognized as edges
const edgeTypes = appConfig.edgeTypes;

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
   for (const file of files)
   {
      const objs = file.objects;
      for (const obj of objs)
      {
         let name;
         Object.keys(obj).forEach((k) => {
            if(keys.includes(k)) {
               name = k;
            }
         });

         const objectType = obj[name]; // the object type is the first key of each object
         const attributes = obj.attributes; // get the atributes of each object
         
         if (nodeTypes.includes(objectType)) // if the object is of a node type then it is added as a node
         {
            Object.keys(attributes).forEach((k) => {
               if(keys.includes(k))
               {
                  name = k;
               }
            })

            const nodeID = attributes[name]; // the ID of each object is in the atributes js Object

            // if the object has x and y coordinates they will be added to the node's object datastructure
            if (Object.keys(attributes).includes("x") && Object.keys(attributes).includes("y"))
            {
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
            else if (Object.keys(attributes).includes("level"))
            {
               if (!options.layout.hierarchical.enabled)
                  options.layout.hierarchical.enabled = true;

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
                  "label": nodeID,
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
   for (const file of files)
   {
      const objs = file.objects;

      for (const obj of objs)
      {
         let name;
         let attributeName;

         Object.keys(obj).forEach((k) => {
            if(keys.includes(k)) {
               name = k;
            }
         })

         const objectType = obj[name];
         const attributes = obj.attributes;

         Object.keys(attributes).forEach(k => {
            if(keys.includes(k))
            {
               attributeName = k;
            }
         })

         if (edgeTypes.includes(objectType))
         {
            const edgeFrom = attributes.from;
            const edgeTo = attributes.to;
            const edgeID = objectType + ":" + attributes[attributeName];
            
            data.edges.add({
               "id": edgeID,
               "from": edgeFrom,
               "to": edgeTo,
               "color": edgeOptions[objectType].color,
               "width": edgeOptions[objectType].width,
               "hidden": edgeOptions[objectType].hidden,
               "title": "Object Type: " + objectType + "\n" + getTitle(attributes)
            });
            
            objectTypeCount.edges[objectType]++;
         }
         else if (nodeTypes.includes(objectType)) // some nodes have a parent attribute
         {
            const nodeID = attributes[attributeName];
            const parent = attributes.parent;
            
            if (parent !== undefined) {
               data.edges.add({
                  "id": `parentChild:${parent}-${nodeID}`,
                  "from": parent,
                  "to": nodeID,
                  "color": {"inherit": true}
               });

               objectTypeCount.edges.parentChild++;
            }
         }
      }
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
   ]

   for (const microgrid of microgrids)
   {
      data.nodes.add({
         id: microgrid.name,
         label: microgrid.name,
         group: "microgrid"
      })

      for (const type of Object.keys(microgrid))
      {
         if(types.includes(type))
         {
            microgrid[type].forEach((nodeID) => {
               data.edges.add({
                  from: microgrid.name,
                  to: nodeID,
                  color: {inherit: true},
                  width: 0.15
               });
            });
         }
      }
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
   if(counter < 0)
   {
      counter = prev.length - 1;
   }
  
   try {
      glmNetwork.focus(prev[counter].id, options)
   } catch {
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
   if(counter === next.length)
   {
      counter = 0;
      try{
         glmNetwork.focus(next[counter].id, options)
      } catch {
         alert("There are no highlighted nodes to cycle through...");
      }
   }
   else
   {
      try {
         glmNetwork.focus(next[counter].id, options)
      } catch {
         alert("There are no highlighted nodes to cycle through...");
      }
   }
}

/**
 * Grays out all edges and nodes that dont mach the node type
 * @param {string} nodeType - The type of nodes to highlight 
 */
const HighlightGroup = (nodeType) => {

   const nodesMap = data.nodes.map((node) => {

      if (node.group === nodeType || node.size === 15)
      {
         delete node.color;
         node.size = 15;
         return node;
      }
      else if (node.group === nodeType && node.size === 15)
      {
         node.size = 1;
         node.color = "lightgrey";
         return node;
      }
   
      node.size = 1;
      node.color = "lightgrey";
      return node;
   });
   
   const edgesMap = data.edges.map((edge) => {

      if(edge.width !== 8)
      {
         edge.color = "lightgrey";
      }

      return edge;
      
   });

   data.nodes.update(nodesMap);
   data.edges.update(edgesMap);
}

/**
 * Grays out the edges and nodes but the edges that are of the passed edge type
 * @param {string} edgeType - The type of edges to highlight
 */
const HighlightEdges = (edgeType) => {
  
   const nodeItems = data.nodes.map((n) => {
      if (n.size !== 15)
      {
         n.color = "lightgrey";
         n.size = 1;

         return n;
      }
      return n;
   });
   
   const edgeItems = data.edges.map((edge) => {
      if (edge.id.split(":")[0] === edgeType)
      {
         edge.color = edgeOptions[edgeType].color;
         edge.width = 8;
         return edge;
      }
      else if (edge.width !== 8)
      {
         edge.color = "lightgrey";
         edge.width = 0.15;
         return edge;
      }
      return edge;
   });
   
   data.nodes.update( nodeItems );
   data.edges.update( edgeItems );
}

/* ------------------------ Component ------------------------ */
const Graph = ({ dataToVis }) => {

   if (data.nodes.length > 0 && data.edges.length > 0) {
      data.nodes = new DataSet();
      data.edges = new DataSet();
      setGraphData( dataToVis );
   }
   else {
      setGraphData(dataToVis);
   }
   
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
            if (nodeTypes.includes(objType))
            {
               const newNodeAttributes = data.nodes.get(object.attributes.name).attributes;
               object.attributes = newNodeAttributes;
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
   const hideEdge = (edgeID) =>
   {
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
         if (e.id.includes(edgeType))
         {
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
      if(contextMenuData !== null)
      {
         setContextMenuData({
            ...contextMenuData,
            "mouseX": e.pageX + 2,
            "mouseY": e.pageY + 6
         });
      }
      else
      {
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

            if (node.group === objectType)
            {
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

   const container = useRef(null);
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
         if (data.nodes.length > 200)
         {
            options.physics.barnesHut.gravitationalConstant = -50000;
            options.physics.barnesHut.springConstant = 0.5;
            options.physics.barnesHut.springLength = 100;
         }

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
            graphDataObj={dataToVis}
            nodesDataObj = {data.nodes}
            physicsToggle = {TogglePhysics}
            reset = {Reset}
            onFind = {NodeFocus}
            prev = {Prev}
            next = {Next}
            download = {Export}
            addGraphOverlay = {setCommunicationNetwork}
            nodeIDs={data.nodes.getIds()}
         />

         <NodePopup 
            onMount = {onChildMount} 
            onSave = {saveEdits} 
            onClose = {closePopUp}
         />

         <div id="networks-wrapper">
         <div
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
            nodeCounts = {objectTypeCount}
            hideObjects = {hideObjects}
         />
         </div>
      </>
   );
}

export default Graph;