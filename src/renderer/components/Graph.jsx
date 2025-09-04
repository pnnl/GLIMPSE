import React, { useEffect, useRef } from "react";
import { Box, Stack } from "@mui/material";
import axios from "axios";
import { v4 } from "uuid";
import { DataSet } from "vis-data";
import { Network } from "vis-network";
import "../styles/Graph.css";
import "../other-styles/vis-network.css";
import {
   currentUploadCounter,
   Export,
   setLegendData,
   getTitle,
   hideEdge,
   hideEdges,
   hideObjects,
   HighlightEdges,
   HighlightGroup,
   Next,
   nodeFocus,
   edgeFocus,
   Prev,
   rotateCCW,
   rotateCW,
   setGraphData,
   showAttributes
} from "../utils/graphUtils";
import ContextMenu from "./ContextMenu";
import Legend from "./Legend";
import NewNodeForm from "./NewNodeForm";
import EditObjectModal from "./EditObjectModal";
import { isGlmFile } from "../utils/appUtils";
import { NewEdgeForm } from "./NewEdgeForm";
import VisRibbon from "./VisRibbon";
const { graphOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ANGLE = Math.PI / 12; // 15 degrees in radians

const Graph = ({ dataToVis, theme, isGlm, isCim, setSearchReqs }) => {
   const networkContainerRef = useRef(null);
   const layoutFormContainerRef = useRef(null);
   const legendContainerRef = useRef(null);
   const circularProgressRef = useRef(null);
   const GLIMPSE_OBJECT = { objects: [] };
   const newCIMobjs = [];
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const counter = { value: -1 }; // counter to navigate through highlighted nodes
   const highlightedNodes = useRef([]);
   const highlightedEdges = useRef([]);
   let network = null; // global network variable
   let edgesToAnimate = {};
   let edgesToAnimateCount = 0;
   let redrawIntervalID = null;

   let setSelectedObject = null;
   let setOpenObjectPopup = null;
   let newNodeFormSetState = null;
   let contextMenuData = null;
   let setContextMenuData = null;
   let newEdgeFormSetState = null;

   const addedOverlayObjects = {
      nodes: [],
      edges: []
   };

   // data object that holds a DataSet for nodes and edges
   const graphData = {
      nodes: new DataSet(),
      edges: new DataSet()
   };

   const legendData = {
      nodes: new DataSet(),
      edges: new DataSet()
   };

   // used to keep count of each object type
   const objectTypeCount = {
      nodes: Object.keys(theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
      edges: Object.keys(theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {})
   };

   objectTypeCount.edges.parentChild = 0;

   /**
    * Reset all nodes and edges back to their original styles
    */
   const Reset = () => {
      edgesToAnimate = {};
      edgesToAnimateCount = 0;

      highlightedNodes.current.length = 0;
      highlightedEdges.current.length = 0;

      const nodesToReset = graphData.nodes.map((node) => {
         node.group = node.type;
         node.hidden = false;

         if (node.attributes && "name" in node.attributes) node.label = node.attributes.name;
         else node.label = node.id;

         return node;
      });

      const edgesToReset = graphData.edges.map((edge) => {
         const edgeType = edge.type;

         if (edgeTypes.includes(edgeType) || edgeType in theme.edgeOptions) {
            Object.assign(edge, theme.edgeOptions[edgeType]);
            edge.hidden = false;

            return edge;
         } else {
            edge.color = { inherit: true };
            edge.width = 0.15;
            edge.hidden = false;

            return edge;
         }
      });

      network.setOptions({ groups: theme.groups });
      graphData.nodes.update(nodesToReset);
      graphData.edges.update(edgesToReset);
      network.fit();
      counter.value = -1;
   };

   /**
    * Turns vis.js' physics on or off
    * @param {bool} toggle - true turns on physics, false turns off physics
    */
   const TogglePhysics = (toggle) => {
      network.setOptions({ physics: { enabled: toggle } });
   };

   /* ------------------ Receive Sate Variables from Children ------------------ */

   /**
    * Used to send the set state function from the child to the parent
    * @param {React.Dispatch<React.SetStateAction<{}>>} setChilNode - The useState function of the NodePopup
    * child component
    * @param {React.Dispatch<React.SetStateAction<false>>} setOpen - Used to display the node popup form
    */
   const onPopupMount = (setChildObj, setOpen) => {
      setSelectedObject = setChildObj;
      setOpenObjectPopup = setOpen;
   };

   /**
    * Takes the state variables of the ContextMenu component
    * so that the parent component may change the state of the child
    * @param {Object} contextMenuDataState - Null or holds x and y data
    * for placing the context menu on the page with the data of the selected edge
    * @param {React.Dispatch<React.SetStateAction<*>>} setContextMenuDataState -
    * Sets the state of the child context menu component
    */
   const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   };

   const onNewNodeFormMount = (setOpenNewNodeForm) => {
      newNodeFormSetState = setOpenNewNodeForm;
   };

   const onNewEdgeFormMount = (setNewEdgeFormState) => {
      newEdgeFormSetState = setNewEdgeFormState;
   };

   const openNewNodeForm = (open) => {
      newNodeFormSetState(open);
   };
   const openNewEdgeForm = (open) => {
      newEdgeFormSetState(open);
   };

   /** close the node pupup component */
   const closePopUp = () => {
      setOpenObjectPopup(false);
   };

   /* ------------------------ End Recive Sate Variables from Children ------------------------ */

   /**
    * Updates the nodes's hover title with the new attributes
    * @param {Object} selectedNode - The node object that was selected to be edited
    */
   const saveEdits = (selectedObj) => {
      console.log(selectedObj);
      if (selectedObj.elementType === "edge") {
         selectedObj.title = getTitle(selectedObj.attributes);
         graphData.edges.update(selectedObj);
      } else {
         selectedObj.title = getTitle(selectedObj.attributes);
         graphData.nodes.update(selectedObj);
      }

      // if the visualization is a CIM model, update the attributes in the backend
      if (isCim) {
         // send the updated attributes to the main process to update the CIM object
         window.glimpseAPI.updateCimObjAttributes({
            mRID: selectedObj.attributes.mRID,
            attributes: selectedObj.attributes
         });
      }

      setOpenObjectPopup(false);
   };

   /**
    * Sets the x and y for the context menu component
    * @param {Event} e
    */
   const handleContextmenu = (e) => {
      e.preventDefault();
      if (contextMenuData !== null) {
         setContextMenuData({
            ...contextMenuData,
            mouseX: e.clientX + 2,
            mouseY: e.clientY + 6
         });
      } else {
         setContextMenuData(null);
      }
   };

   /**
    *
    * @param {object} overlayFileData already acquired overlay data
    * @param {Number} modelNumber model number to get the right grid.json to overlay
    */
   const applyOverlay = async (overlayFileData, modelNumber = -1, topology) => {
      let microGrids = null;

      if (modelNumber !== -1) {
         const res = await fetch(`./grids/feeder_${modelNumber}/grid.json`);
         microGrids = await res.json();
         microGrids = microGrids.microgrid;
      } else {
         microGrids = overlayFileData.microgrid;
      }

      const microGridNodeTypes = new Set([
         "node",
         "load",
         "inverter",
         "capacitor",
         "diesel_dg",
         "triplex_meter",
         "triplex_node",
         "triplex_load",
         "microgirds",
         "communication_node"
      ]);

      const newNodes = [];
      const newEdges = [];

      for (const microGrid of microGrids) {
         const microGridNode = {
            id: microGrid.name,
            label: microGrid.name,
            type: "microgrid",
            group: "microgrid",
            title: `ObjectType: microgrid\nname: ${microGrid.name}`
         };

         newNodes.push(microGridNode);
         addedOverlayObjects.nodes.push(microGrid.name);
         objectTypeCount.nodes.microgrid++;

         const types = Object.keys(microGrid);
         for (const type of types) {
            if (!microGridNodeTypes.has(type)) continue;

            for (const nodeID of microGrid[type]) {
               if (graphData.nodes.get(nodeID) === null) {
                  throw new Error(`Node ${nodeID} does not exists in the graph.`);
               }

               const newEdgeID = `${microGrid.name}-${nodeID}`;
               const microGridEdge = {
                  id: newEdgeID,
                  from: microGrid.name,
                  to: nodeID,
                  title:
                     "objectType: microgrid_connection\n" +
                     getTitle({ name: newEdgeID, from: microGrid.name, to: nodeID }),
                  color: { inherit: true },
                  type: "microgrid_connection",
                  width: 0.25
               };
               newEdges.push(microGridEdge);
               addedOverlayObjects.edges.push(newEdgeID);
               objectTypeCount.edges.microgrid_connection++;
            }
         }
      }

      console.log(topology);

      if (topology) {
         for (const commNode of topology.Node) {
            let commNodeID = null;
            let mgNumber = null;

            if (typeof commNode.name === "string") {
               commNodeID = commNode.name;
               mgNumber = parseInt(commNode.name.match(/\d+$/)[0], 10);
            } else {
               commNodeID = `comm${commNode.name + 1}`;
               mgNumber = commNode.name + 1;
            }

            newNodes.push({
               id: commNodeID,
               label: commNodeID,
               type: "communication_node",
               group: "communication_node",
               title: `ObjectType: communication_node\nname: ${commNodeID}`
            });

            addedOverlayObjects.nodes.push(commNodeID);
            objectTypeCount.nodes.communication_node++;

            let commEdgeID = `${commNodeID}-SS_${mgNumber}`;
            newEdges.push({
               id: commEdgeID,
               from: commNodeID,
               to: `SS_${mgNumber}`,
               title:
                  "objectType: parentChild\n" +
                  getTitle({
                     name: commEdgeID,
                     from: commNodeID,
                     to: `SS_${mgNumber}`
                  }),
               color: { inherit: true },
               type: "communication",
               width: 2
            });

            addedOverlayObjects.edges.push(commEdgeID);
            objectTypeCount.edges.communication++;

            for (const connection of commNode.connections) {
               let to = null;

               if (typeof connection === "string") {
                  commEdgeID = `${commNodeID}-${connection}`;
                  to = connection;
               } else {
                  commEdgeID = `${commNodeID}-comm${connection + 1}`;
                  to = `comm${connection + 1}`;
               }

               newEdges.push({
                  id: commEdgeID,
                  from: commNodeID,
                  to: to,
                  title:
                     "objectType: parentChild\n" +
                     getTitle({ name: commEdgeID, from: commNodeID, to: to }),
                  color: { inherit: true },
                  type: "communication",
                  width: 2
               });

               addedOverlayObjects.edges.push(commEdgeID);
               objectTypeCount.edges.communication++;
            }
         }
      }
      // Batch add nodes and edges
      graphData.nodes.add(newNodes);
      graphData.edges.add(newEdges);

      setLegendData(objectTypeCount, theme, legendData);
   };

   /**
    * Adds new nodes and edges based on the overlay json file data
    * @param {Object} fileData - the json object read from the file
    */
   const setOverlay = async (filePaths, showRemoveOverlayBtn) => {
      if (filePaths.every((file) => isGlmFile(file))) {
         // sed file paths to be parsed and validated in the main process
         const data = await window.glimpseAPI.glm2json(filePaths);

         if (!data) {
            alert("Something went wrong... \n try re-uploading or reset the application app");
         } else if ("alert" in data) {
            alert(data.alert);
         } else {
            // set and overlay the additional model
            setGraphData(
               graphData,
               data,
               nodeTypes,
               edgeTypes,
               objectTypeCount,
               GLIMPSE_OBJECT,
               theme,
               graphOptions
            );

            setLegendData(objectTypeCount, theme, legendData);
         }
      } else {
         try {
            let topologyData = null;
            const fileDataPromise = window.glimpseAPI.readJsonFile(filePaths[0]);
            const fileData = await fileDataPromise;

            // if the there is another file it may be the topology file
            if (filePaths.length === 2) {
               const topologyDataPromise = window.glimpseAPI.readJsonFile(filePaths[1]);
               topologyData = await topologyDataPromise;
            }

            await applyOverlay(fileData, undefined, topologyData);
            showRemoveOverlayBtn(true);
         } catch (error) {
            alert(error.message);
         }
      }
   };

   /**
    * Create and visualize a new node in either CIM or GLM model
    * @param {Object} newNodeObj - contains the new values from each field in the new node form
    * @param {number} newNodeObj.nodeType - The index of the node type in the nodeTypes list
    * @param {string} newNodeObj.nodeID - The ID for the new node
    * @param {string} newNodeObj.connectTo - The ID of an existing Node to connect the new node
    * @param {number} newNodeObj.edgeType - The index of the edge type in the edgeTypes list
    */
   const addNewNode = ({ nodeType, nodeID, connectTo, edgeType }) => {
      const nodeTypes = Object.keys(objectTypeCount.nodes).filter(
         (key) => objectTypeCount.nodes[key] > 0
      );
      const edgeTypes = Object.keys(objectTypeCount.edges).filter(
         (key) => objectTypeCount.edges[key] > 0
      );

      if (isCim) {
         const NEW_C_NODE_ID = `${v4()}`; // new node for new terminal
         const NEW_NODE_ID = `${v4()}`; // new terminal with type
         const newNodes = [];
         const newEdges = [];

         const CimObj = [];
         // [0] = new nerminal with type
         // [1] = new connectivity node
         // [2] = existing connectivity node

         // new terminal with type
         const newNode = {
            id: NEW_NODE_ID,
            mRID: NEW_NODE_ID,
            label: nodeID,
            name: nodeID,
            group: nodeTypes[nodeType],
            type: nodeTypes[nodeType],
            parent: NEW_C_NODE_ID,
            attributes: {
               mRID: NEW_NODE_ID,
               name: nodeID,
               parent: NEW_C_NODE_ID
            }
         };

         newNode.title = getTitle({ ObjectType: nodeTypes[nodeType], ...newNode.attributes });
         newNodes.push(newNode);
         CimObj.push({
            name: newNode.name,
            type: newNode.type
         });

         // New Connectivity Node
         const newCNode = {
            id: NEW_C_NODE_ID,
            mRID: NEW_C_NODE_ID,
            name: `c_node:${nodeID}`,
            label: `c_node:${nodeID}`,
            group: "c_node",
            type: "c_node",
            attributes: {
               mRID: NEW_C_NODE_ID,
               name: `c_node:${nodeID}`
            }
         };
         newCNode.title = getTitle({ ObjectType: "c_node", ...newCNode.attributes });
         newNodes.push(newCNode);
         CimObj.push({
            mRID: newCNode.mRID,
            name: newCNode.name
         });

         // connect new connectivity node with new node
         let edgeID = `${NEW_C_NODE_ID}-${NEW_NODE_ID}`;
         let newEdge = {
            id: edgeID,
            from: NEW_C_NODE_ID,
            to: NEW_NODE_ID,
            color: theme.edgeOptions.line.color,
            width: theme.edgeOptions.line.width,
            attributes: {
               id: edgeID,
               from: NEW_C_NODE_ID,
               to: NEW_NODE_ID
            }
         };
         newEdge.title = getTitle({
            objectType: "line",
            ...newEdge.attributes
         });
         newEdges.push(newEdge);

         // connect new connectivity node with existing connectivity node
         edgeID = `${connectTo}-${NEW_C_NODE_ID}`;
         newEdge = {
            id: edgeID,
            from: connectTo,
            to: NEW_C_NODE_ID,
            type: edgeTypes[edgeType],
            attributes: {
               id: edgeID,
               from: connectTo,
               to: NEW_C_NODE_ID
            },
            color: theme.edgeOptions[edgeTypes[edgeType]].color,
            width: theme.edgeOptions[edgeTypes[edgeType]].width
         };
         newEdge.title = getTitle({ objectType: edgeTypes[edgeType], ...newEdge.attributes });
         newEdges.push(newEdge);

         // get existing connectTo node name
         const connectToNode = graphData.nodes.get(connectTo);
         CimObj.push({
            mRID: connectToNode.attributes.id,
            name: connectToNode.attributes.name
         });

         newCIMobjs.push(CimObj);

         graphData.nodes.add(newNodes);
         graphData.edges.add(newEdges);
      } else if (isGlm) {
         const newNodeCID = graphData.nodes.get(connectTo).communityID;

         const newNode = {
            id: nodeID,
            label: nodeID,
            type: nodeTypes[nodeType],
            group: nodeTypes[nodeType],
            communityID: newNodeCID,
            elementType: "node",
            attributes: {
               id: nodeID
            }
         };

         newNode.title = getTitle({ objectType: nodeTypes[nodeType], ...newNode.attributes });
         objectTypeCount.nodes[newNode.type]++;

         const newEdge = {
            id: `${connectTo}-${newNode.id}`,
            from: connectTo,
            to: newNode.id,
            type: edgeTypes[edgeType],
            elementType: "edge",
            color: theme.edgeOptions[edgeTypes[edgeType]].color,
            width: theme.edgeOptions[edgeTypes[edgeType]].width
         };

         const { color, width, elementType, type, ...rest } = newEdge;
         newEdge.title = getTitle({ ObjectType: edgeTypes[edgeType], ...rest });
         objectTypeCount.edges[newEdge.type]++;

         try {
            graphData.edges.add(newEdge);
         } catch (err) {
            console.error(err);
            alert(
               `There was an error adding edge: ${newEdge.id}. Double check if it already exists.`
            );
            return;
         }

         try {
            graphData.nodes.add(newNode);
         } catch (err) {
            console.error(err);
            alert(
               `There was an error adding node: ${newNode.id}. Double check if it already exists.`
            );
            graphData.edges.remove(newEdge.id);
            return;
         }

         setLegendData(objectTypeCount, theme, legendData);
      } else {
         const newNodeType = nodeTypes[nodeType];
         const newNode = {
            id: nodeID,
            label: nodeID,
            type: newNodeType,
            group: newNodeType,
            elementType: "node",
            attributes: {
               id: nodeID
            }
         };
         newNode.title = getTitle({ objectType: newNodeType, ...newNode.attributes });
         objectTypeCount.nodes[newNodeType]++;

         try {
            graphData.nodes.add(newNode);
            setLegendData(objectTypeCount, theme, legendData);
         } catch (error) {
            console.log(error);
            alert(
               `There was an error adding node: ${newNode.id}. Double check if it already exists.`
            );
         }
      }
   };

   const addNewEdge = (formObj) => {
      // "title" key is tooltip popup
      const newEdge = {
         id: formObj.edgeID,
         from: formObj.from,
         to: formObj.to,
         group: formObj.edgeType,
         attributes: {
            id: formObj.edgeID,
            from: formObj.from,
            to: formObj.to
         },
         elementType: "edge",
         title:
            `Object Type: ${formObj.edgeType}\n` +
            getTitle({
               ID: formObj.edgeID,
               from: formObj.from,
               to: formObj.to
            }),
         animation: formObj.animate,
         type: formObj.edgeType,
         color: theme.edgeOptions[formObj.edgeType].color,
         width: theme.edgeOptions[formObj.edgeType].width
      };

      graphData.edges.add(newEdge);
      objectTypeCount.edges[formObj.edgeType]++;

      if (formObj.animate) {
         animateEdge(newEdge.id);
      }

      setLegendData(objectTypeCount, theme, legendData);
   };

   const updateVisObjects = (updateData) => {
      console.log(updateData);

      if (updateData.elementType === "node") {
         const node = graphData.nodes.get(updateData.id);
         graphData.nodes.update({ ...node, ...updateData.updates });
      } else {
         const edge = graphData.edges.get(updateData.id);
         const clusteredEdges = network.clustering.getClusteredEdges(edge.id);

         if ("animation" in updateData.updates) {
            const { animation, increment, startFrom, ...rest } = updateData.updates;

            // if the first element of the clustered edges array is not the passed edge ID
            // then there are clustered edges
            if (!(clusteredEdges[0] === edge.id)) {
               // the first element will then be the current visible clustered edge
               animateEdge(clusteredEdges[0], increment, startFrom);
            } else {
               animateEdge(edge.id, increment, startFrom);
            }

            graphData.edges.update({ ...edge, ...rest });

            if (!redrawIntervalID) {
               redrawIntervalID = setInterval(() => network.redraw(), 16.67);
            }
         } else {
            graphData.edges.update({ ...edge, ...updateData.updates });
         }
      }
   };

   const animateEdges = (ctx) => {
      let start = null;
      let end = null;

      if (edgesToAnimateCount > 0) {
         try {
            for (const edgeID in edgesToAnimate) {
               const edge = edgesToAnimate[edgeID];
               const canvasEdge = network.body.edges[edgeID];

               if (!canvasEdge) continue;

               if (edge.startFrom === "target") {
                  start = canvasEdge.to;
                  end = canvasEdge.from;
               } else {
                  start = canvasEdge.from;
                  end = canvasEdge.to;
               }

               // Calculate the circle's position along the edge
               edge.position += edge.increment;
               if (edge.position > 1) {
                  edge.position = 0;
               }

               // Interpolate the position along the edge
               const x = start.x * (1 - edge.position) + end.x * edge.position;
               const y = start.y * (1 - edge.position) + end.y * edge.position;

               // Calculate the direction vector
               const dx = end.x - start.x;
               const dy = end.y - start.y;

               // Calculate the angle of rotation
               const angle = Math.atan2(dy, dx);

               // Define the triangle dimensions
               const sideLength = 7; // Base width of the triangle
               const triangleHeight = (Math.sqrt(3) / 2) * sideLength; // Height of the triangle

               // Define the triangle points relative to the origin (0, 0)
               // The triangle is initially pointing to the right (positive x-axis)
               const trianglePoints = [
                  { x: triangleHeight * (2 / 3), y: 0 }, // Top point (front of the arrow)
                  { x: -triangleHeight * (1 / 3), y: -sideLength / 2 }, // Bottom left point
                  { x: -triangleHeight * (1 / 3), y: sideLength / 2 } // Bottom right point
               ];

               // Rotate and translate the triangle points
               const rotatedPoints = trianglePoints.map((point) => {
                  const rotatedX = point.x * Math.cos(angle) - point.y * Math.sin(angle);
                  const rotatedY = point.x * Math.sin(angle) + point.y * Math.cos(angle);
                  return {
                     x: rotatedX + x,
                     y: rotatedY + y
                  };
               });

               // Draw the triangle
               ctx.beginPath();
               ctx.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);

               for (let i = 1; i < rotatedPoints.length; i++) {
                  ctx.lineTo(rotatedPoints[i].x, rotatedPoints[i].y);
               }

               ctx.closePath();
               ctx.strokeStyle = "black";
               ctx.stroke();
               ctx.fillStyle = "orange";
               ctx.fill();
            }
         } catch (msg) {
            console.error(msg);
            if (redrawIntervalID) {
               clearInterval(redrawIntervalID);
               redrawIntervalID = null;
            }
            edgesToAnimate = {};
         }
      }
   };

   /**
    * Removes the edge from the list of edges to animate.
    * @param {string} edgeID The ID of an animated edge
    */
   const removeEdgeAnimation = (edgeID) => {
      delete edgesToAnimate[edgeID];
      edgesToAnimateCount--;

      console.log(`Animation removed from: ${edgeID}`);

      if (edgesToAnimateCount === 0) {
         clearInterval(redrawIntervalID);
         console.log(`Redraw interval removed: ${redrawIntervalID}`);
         network.redraw();
         redrawIntervalID = null;
      }
   };

   /**
    *
    * @param {string} edgeID The ID of an edge to animate
    * @param {float} value An increment value between 0.1 - 0.001 to determine the animation's speed (default: 0.01)
    * @param {string} startFrom start the animation of an edge from its `"source"` or `"target"`
    */
   const animateEdge = (edgeID, value = 0.01, startFrom = "source") => {
      if (value === undefined) value = 0.01;
      if (startFrom === undefined) startFrom = "source";

      console.log(`Animating edge: ${edgeID}`);

      try {
         // if the edge to animate is a clustered edge animate as normal
         if (edgeID.includes("clusterEdge") && !(edgeID in edgesToAnimate)) {
            edgesToAnimate[edgeID] = {
               position: 0,
               increment: value,
               startFrom: startFrom
            };
            edgesToAnimateCount++;

            if (!redrawIntervalID) {
               redrawIntervalID = setInterval(() => network.redraw(), 16.67);
            }
         } else if (!(edgeID in edgesToAnimate)) {
            // add it to the list of edges to animate and the positions object
            edgesToAnimate[edgeID] = {
               position: 0,
               increment: value,
               startFrom: startFrom
            };

            edgesToAnimateCount++;

            // if this was the first edge to be animated create a new
            // redraw interval
            if (!redrawIntervalID) {
               redrawIntervalID = setInterval(() => network.redraw(), 16.67);
               console.log(redrawIntervalID);
            }

            // If the edge ID is already in the edges to animate list
            // remove it
         } else {
            edgesToAnimate[edgeID] = {
               ...edgesToAnimate[edgeID],
               increment: value,
               startFrom: startFrom
            };
         }
      } catch (err) {
         console.log(`Could not animate edge: ${edgeID}`);
         console.error(err);
      }
   };

   /**
    * Delete a node along with the edges connected to it and updating the legend
    * @param {string} nodeID the ID of a node to delete
    */
   const deleteNode = (nodeID) => {
      // delete from file data
      Object.keys(dataToVis).forEach((filename) => {
         const objects = dataToVis[filename].objects;
         dataToVis[filename].objects = objects.filter((obj) => obj.attributes.name !== nodeID);
      });

      const nodeObject = graphData.nodes.get(nodeID);
      // get node obj and subtract from that node type's count
      objectTypeCount.nodes[nodeObject.type]--;

      const edgesToDelete = [];
      const graphEdges = graphData.edges.get();
      for (let edge of graphEdges) {
         if (edge.from === nodeID || edge.to === nodeID) {
            edgesToDelete.push(edge.id);
            objectTypeCount.edges[edge.type]--;
         }
      }

      graphData.nodes.remove(nodeID);
      graphData.edges.remove(edgesToDelete);

      console.log("DELETED: " + nodeID);

      setLegendData(objectTypeCount, theme, legendData);
   };

   const deleteEdge = (edgeID) => {
      // check if the edgeID is a cluster edge ID
      if (edgeID.includes("clusterEdge")) {
         // get the base edge of the clustered edge
         const [baseEdge] = network.clustering.getBaseEdges(edgeID);

         // get the edge object from the graph data
         const edgeToDelete = graphData.edges.get(baseEdge);

         delete network.body.edges[edgeID];

         // if the edge is animated remove animation and clear
         // redraw animation interval if there are no other edges to animate
         if (edgeID in edgesToAnimate) {
            removeEdgeAnimation(edgeID);

            // clear redraw interval if there are no other edges to animate
            if (edgesToAnimateCount === 0) {
               clearInterval(redrawIntervalID);
               redrawIntervalID = null;
               network.redraw();
            }
         }

         // remove the edge and update the count of the edge type the edge belonged to.
         objectTypeCount.edges[edgeToDelete.type]--;
         graphData.edges.remove(edgeToDelete);
      } else {
         // grab the edge type of the edge that will be deleted
         const { type: edgeType } = graphData.edges.get(edgeID);

         // check if the edge is currently being animated
         if (edgeID in edgesToAnimate) {
            // remove it from the edges to animate list and the positions tracker object
            removeEdgeAnimation(edgeID);

            // clear the redraw interval if there are no more edges to animate
            if (edgesToAnimateCount === 0) {
               clearInterval(redrawIntervalID);
               redrawIntervalID = null;
               network.redraw();
            }
         }

         objectTypeCount.edges[edgeType]--;
         graphData.edges.remove(edgeID);
      }

      // update the legend to reflect the new number of edges after deleting
      setLegendData(objectTypeCount, theme, legendData);
   };

   /**
    * Hides the legend container and shows the vis.js layout options form
    */
   /**
    * Hides the legend container and shows the vis.js layout options form
    */
   const toggleVisOptions = () => {
      if (layoutFormContainerRef.current.style.display === "") {
         networkContainerRef.current.style.width = "72%";
         layoutFormContainerRef.current.style.display = "flex";
         legendContainerRef.current.style.display = "none";
      } else {
         if (networkContainerRef.current.style.width === "30%") {
            networkContainerRef.current.style.width = "72%";
         }
         layoutFormContainerRef.current.style.display = "";
         legendContainerRef.current.style.display = "block";
      }
   };

   /**
    * Removes all nodes and edges added through the overlay upload feature
    * and updates the legend
    */
   const removeOverlay = () => {
      graphData.nodes.get(addedOverlayObjects.nodes).forEach((node) => {
         objectTypeCount.nodes[node.type]--;
      });

      graphData.edges.get(addedOverlayObjects.edges).forEach((edge) => {
         objectTypeCount.edges[edge.type]--;
      });
      graphData.nodes.remove(addedOverlayObjects.nodes);
      graphData.edges.remove(addedOverlayObjects.edges);

      addedOverlayObjects.nodes.length = 0;
      addedOverlayObjects.edges.length = 0;

      setLegendData(objectTypeCount, theme, legendData);
   };

   /**
    * Applies the node and edge styes from the them builder component and updates the legend
    * @param {Object} newStyles
    * @param {Object} newStyles.newNodeStyles
    * @param {Object} newStyles.newEdgeStyles
    */
   const applyTheme = ({ newNodeStyles, newEdgeStyles }) => {
      console.log(newNodeStyles);
      const { group, size, ...restOfNodeStyles } = newNodeStyles;
      theme.groups[group] = { size: Number(size), ...restOfNodeStyles };
      network.setOptions({ groups: theme.groups });

      const { type, ...restOfEdgeStyles } = newEdgeStyles;
      theme.edgeOptions[type] = restOfEdgeStyles;

      graphData.edges.update(
         graphData.edges.map((edge) => {
            if (edge.type === type) {
               edge = {
                  ...edge,
                  ...restOfEdgeStyles
               };
            }
            return edge;
         })
      );

      setLegendData(objectTypeCount, theme, legendData);
   };

   const createClusterNode = (clusterValue) => {
      const newClusterValue =
         typeof clusterValue === "number" ? `CID_${clusterValue}` : clusterValue;

      network.cluster({
         joinCondition: (childOptions) => {
            if (typeof childOptions.communityID === "number")
               return `CID_${childOptions.communityID}` === newClusterValue;

            // if the communityID is a string then it has a cluster value of CID_[n]
            return childOptions.communityID === newClusterValue;
         },
         processProperties: (clusterOptions, childNodes, childEdges) => {
            clusterOptions.value = childNodes.length;
            clusterOptions.title = `Nodes in Cluster: ${childNodes.length}`;
            clusterOptions.mass = childNodes.length * 0.25;
            return clusterOptions;
         },
         clusterNodeProperties: {
            id: newClusterValue,
            borderWidth: 3,
            shape: "hexagon",
            label: newClusterValue,
            color: "#246CAB"
         }
      });

      if (edgesToAnimateCount > 0) {
         const clusterNode = network.body.nodes[newClusterValue];
         if (clusterNode.edges.length > 0) {
            for (let i = 0; i < clusterNode.edges.length; i++) {
               const currentClusteredEdge = clusterNode.edges[i];
               const [baseEdge] = network.clustering.getBaseEdges(currentClusteredEdge.id);
               const previousClusteredEdge = currentClusteredEdge.clusteringEdgeReplacingIds[0];

               if (baseEdge in edgesToAnimate) {
                  removeEdgeAnimation(baseEdge);
                  animateEdge(currentClusteredEdge.id);
               } else if (previousClusteredEdge in edgesToAnimate) {
                  removeEdgeAnimation(previousClusteredEdge);
                  animateEdge(currentClusteredEdge.id);
               }
            }
         }
      }
   };

   const deCluster = (clusterNodeID) => {
      const { edges: clusteredEdges } = network.body.nodes[clusterNodeID];
      const newEdgesToAnimate = [];

      for (const clusteredEdge of clusteredEdges) {
         // skip edges that are not animated
         if (!(clusteredEdge.id in edgesToAnimate)) continue;

         // remove animation from current clustered edge
         removeEdgeAnimation(clusteredEdge.id);

         // add the edge replacing id to be animated
         newEdgesToAnimate.push(clusteredEdge.clusteringEdgeReplacingIds[0]);
      }
      // open the clustered node before animating the new edges
      network.openCluster(clusterNodeID);
      // the animateEdge function will resume the redraw interval
      if (newEdgesToAnimate.length > 0) {
         for (const edgeID of newEdgesToAnimate) {
            animateEdge(edgeID);
         }
      }
   };

   /* ------ Establish Listeners Between Main process and renderer process ----- */
   useEffect(() => {
      const removeListenerArr = [];
      removeListenerArr.push(window.glimpseAPI.onShowVisOptions(toggleVisOptions));
      removeListenerArr.push(
         window.glimpseAPI.onExtract(() =>
            Export(network, graphData, isGlm, isCim, dataToVis, newCIMobjs)
         )
      );
      removeListenerArr.push(
         window.glimpseAPI.onShowAttributes((show) => showAttributes(show, graphData))
      );
      removeListenerArr.push(
         window.glimpseAPI.onExportTheme(() =>
            window.glimpseAPI.exportTheme(JSON.stringify(theme, null, 3))
         )
      );
      removeListenerArr.push(
         window.glimpseAPI.onUpdateData((updateData) => updateVisObjects(updateData))
      );
      removeListenerArr.push(
         window.glimpseAPI.onAddNodeEvent((newNodeData) => {
            graphData.nodes.add({
               id: newNodeData.attributes.id,
               label: newNodeData.attributes.id,
               elementType: "node",
               attributes: newNodeData.attributes,
               type: newNodeData.objectType,
               group: newNodeData.objectType,
               title: `ObjectType: ${newNodeData.objectType}\n${getTitle(newNodeData.attributes)}`,
               ...newNodeData.styles
            });
         })
      );
      removeListenerArr.push(
         window.glimpseAPI.onAddEdgeEvent((newEdgeData) => {
            graphData.edges.add({
               id: newEdgeData.attributes.id,
               to: newEdgeData.attributes.to,
               from: newEdgeData.attributes.from,
               attributes: newEdgeData.attributes,
               elementType: "edge",
               title: `Type: ${newEdgeData.objectType}\n${getTitle(newEdgeData.attributes)}`,
               ...newEdgeData.styles
            });
         })
      );
      removeListenerArr.push(
         window.glimpseAPI.onDeleteNodeEvent((nodeID) => {
            graphData.nodes.remove(nodeID);
         })
      );
      removeListenerArr.push(
         window.glimpseAPI.onDeleteEdgeEvent((edgeID) => {
            graphData.edges.remove(edgeID);
         })
      );

      /*
         Remove listeners when component dismounts to prevent
         duplication of events when component mounts again
      */
      return () => {
         for (let removeListener of removeListenerArr) {
            removeListener();
         }

         graphOptions.physics.solver = "barnesHut";
         graphOptions.layout.hierarchical.enabled = false;
         graphOptions.physics.stabilization.enabled = true;
         graphOptions.physics.enabled = true;
      };
   }, []);
   /* ---- End Establish Listeners Between Main process and renderer process --- */

   /* --------------------------- visualization hook --------------------------- */
   useEffect(() => {
      const circularProgressBar = document.getElementById("circularProgress");
      const circularProgressValue = document.getElementById("progressValue");
      let establishCommunities = false;
      /* ---------------------------- Establish Network --------------------------- */
      setGraphData(
         graphData,
         dataToVis,
         nodeTypes,
         edgeTypes,
         objectTypeCount,
         GLIMPSE_OBJECT,
         theme,
         graphOptions
      );
      /* ---------------------------- Establish Network --------------------------- */
      setLegendData(objectTypeCount, theme, legendData);

      console.log("Number of Nodes: " + graphData.nodes.length);
      console.log("Number of Edges: " + graphData.edges.length);

      const establishNetworkxGraph = async (data) => {
         try {
            const res = await axios.post("http://127.0.0.1:5051/create-nx-graph", data, {
               headers: "application/json"
            });

            if (res.status === 200) {
               const communityIDs = res.data;
               const updatedNodes = graphData.nodes.map((node) => {
                  node.communityID = communityIDs[node.id];
                  return node;
               });

               graphData.nodes.update(updatedNodes);

               // returns an array of unique community IDs
               return [...new Set(graphData.nodes.map((node) => node.communityID))];
            }
         } catch (err) {
            console.log(err);
         }
      };

      const initializeGraph = async () => {
         let CommunityIDs = null;

         const dontCluster = graphData.nodes
            .get()
            .some((node) => node.x !== undefined && node.y !== undefined);

         if (dontCluster || graphData.nodes.length < 251) {
            // this will create and establish the networkx GRAPH object in the
            await establishNetworkxGraph(GLIMPSE_OBJECT);
         } else {
            // This will result in a array of unique community IDs and establish the networkx object in server
            const communityIDsPromise = await establishNetworkxGraph([GLIMPSE_OBJECT, true]);
            CommunityIDs = communityIDsPromise;
            establishCommunities = true;
            graphOptions.physics.barnesHut.damping = 0.6;
         }

         if (
            graphData.nodes.length > 151 &&
            graphData.nodes.length <= 300 &&
            graphData.edges.length >= 7000
         ) {
            graphOptions.physics.solver = "forceAtlas2Based";
         }

         graphOptions.groups = theme.groups;
         network = new Network(networkContainerRef.current, graphData, graphOptions);

         // Create clusters
         if (establishCommunities) {
            network.setOptions({ physics: { barnesHut: { springLength: 140 } } });
            for (const communityID of CommunityIDs) createClusterNode(communityID);
         }

         network.on("stabilizationProgress", (params) => {
            circularProgressBar.style.display = "flex";
            /* Math for determining the radius of the circular progress bar based on the stabilization progress */
            const maxWidth = 360;
            const minWidth = 1;
            const widthFactor = params.iterations / params.total;
            const width = Math.max(minWidth, maxWidth * widthFactor);
            circularProgressBar.style.background = `conic-gradient(#45AB48 ${width}deg, #333 0deg)`;
            circularProgressValue.innerText = Math.round(widthFactor * 100) + "%";
         });

         network.once("stabilizationIterationsDone", () => {
            /* Once stabilization is done the circular progress with display 100% for half a second then hide */
            circularProgressBar.style.background = "conic-gradient(#45AB48 360deg, #333 0deg)";
            circularProgressValue.innerText = "100%";
            circularProgressBar.style.opacity = 0.7;

            /* set physics to false for better performance when stabilization is done */
            network.setOptions({ physics: { enabled: false } });

            setTimeout(() => {
               circularProgressBar.style.display = "";
            }, 500);
         });

         // after drawing animate edges if there are any to animate
         network.on("afterDrawing", (ctx) => animateEdges(ctx));

         /* Display the child Context menu component to hide an edge or edge types */
         network.on("oncontext", (params) => {
            const contextNodeID = network.getNodeAt(params.pointer.DOM);
            const contextEdgeID = network.getEdgeAt(params.pointer.DOM);

            if (contextEdgeID && !contextNodeID) {
               setContextMenuData({
                  edgeID: contextEdgeID
               });
            } else if (contextNodeID && !network.clustering.isCluster(contextNodeID)) {
               const nodeData = graphData.nodes.get(contextNodeID);

               if ("communityID" in nodeData) {
                  setContextMenuData({
                     nodeID: nodeData.id,
                     CID: nodeData.communityID
                  });
               } else {
                  setContextMenuData({
                     nodeID: nodeData.id
                  });
               }
            } else if (contextNodeID && network.clustering.isCluster(contextNodeID)) {
               setContextMenuData({
                  clusterNodeID: contextNodeID
               });
            } else {
               setContextMenuData({});
            }
         });

         network.setOptions({
            configure: {
               filter: (option, path) => {
                  if (path.indexOf("physics") !== -1) return true;
                  if (path.indexOf("smooth") !== -1 || option === "smooth") return true;

                  return false;
               },
               container: document.getElementById("layout-form")
            }
         });
      };

      initializeGraph();

      setSearchReqs({
         graphData: graphData,
         findNode: (node) => nodeFocus(node, network),
         findEdge: (edge) => edgeFocus(edge, network)
      });

      return () => {
         if (redrawIntervalID) {
            clearInterval(redrawIntervalID);
            redrawIntervalID = null;
         }

         currentUploadCounter.value = 0;
         GLIMPSE_OBJECT.objects.length = 0;
         layoutFormContainerRef.current = null;
         legendContainerRef.current = null;
         graphData.edges.clear();
         graphData.nodes.clear();
         network = null;
      };
   }, []);
   /* ------------------------- End visualization hook ------------------------- */

   return (
      <>
         <VisRibbon
            reset={Reset}
            setOverlay={setOverlay}
            physicsToggle={TogglePhysics}
            removeOverlay={removeOverlay}
            graphData={graphData}
            legendContainerRef={legendContainerRef}
            circularProgressRef={circularProgressRef}
            rotateCW={() => rotateCW(network, ANGLE)}
            networkContainerRef={networkContainerRef}
            layoutContainerRef={layoutFormContainerRef}
            rotateCCW={() => rotateCCW(network, ANGLE)}
            prev={() => Prev(network, highlightedNodes, counter)}
            next={() => Next(network, highlightedNodes, counter)}
            isCIM={isCim}
         />

         <Stack
            className="vis-wrapper"
            sx={{ height: "calc(100% - 8.6rem)", width: "100%" }}
            direction={"row"}
         >
            <Box
               id="graph"
               component={"div"}
               sx={{ width: "72%", height: "100%" }}
               ref={networkContainerRef}
               onContextMenu={handleContextmenu}
            />

            <Legend
               highlightNodes={(nodeType) =>
                  HighlightGroup(nodeType, graphData, highlightedNodes, highlightedEdges)
               }
               highlightEdges={(edgeType) =>
                  HighlightEdges(
                     edgeType,
                     highlightedNodes,
                     graphData,
                     theme.edgeOptions,
                     highlightedEdges
                  )
               }
               hideObjects={(objType, type) => hideObjects(objType, type, graphData)}
               legendData={legendData}
               theme={theme}
               legendContainerRef={legendContainerRef}
               applyTheme={applyTheme}
            />
            <div ref={layoutFormContainerRef} id="layout-form" />
         </Stack>

         <EditObjectModal
            onMount={onPopupMount}
            onSave={saveEdits}
            close={closePopUp}
            graphData={graphData}
         />

         <NewEdgeForm
            onMount={onNewEdgeFormMount}
            nodes={() => graphData.nodes.getIds()}
            edgeTypes={edgeTypes}
            createEdge={addNewEdge}
         />

         <NewNodeForm
            onMount={onNewNodeFormMount}
            nodes={() => graphData.nodes.getIds()}
            addNode={addNewNode}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
         />

         <div ref={circularProgressRef} id="circularProgress">
            <span id="progressValue">0%</span>
         </div>

         <ContextMenu
            onMount={onContextMenuChildMount}
            hideEdge={(id) => hideEdge(id, graphData)}
            hideEdges={(type) => hideEdges(type, graphData)}
            openNewNodeForm={openNewNodeForm}
            openNewEdgeForm={openNewEdgeForm}
            deleteNode={deleteNode}
            createCluster={createClusterNode}
            openCluster={(id) => deCluster(id)}
            removeAnimation={removeEdgeAnimation}
            isEdgeAnimated={(id) => id in edgesToAnimate}
            animateEdge={animateEdge}
            deleteEdge={deleteEdge}
            setObj={(obj) => setSelectedObject(obj)}
            openPopup={(open) => setOpenObjectPopup(open)}
            graphData={graphData}
         />
      </>
   );
};

export default Graph;
