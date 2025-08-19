import { useEffect, useRef } from 'react';
import { Box, Stack } from '@mui/material';
import axios from 'axios';
import { DataSet } from 'vis-data';
import { Network } from 'vis-network';
import '../styles/Graph.css';
import '../other-styles/vis-network.css';
import {
   currentUploadCounter,
   Export,
   setLegendData,
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
   showAttributes,
   getHtmlTitle
} from '../utils/graphUtils';
import ContextMenu from './ContextMenu';
import Legend from './Legend';
import NewNodeForm from './NewNodeForm';
import NodePopup from './NodePopup';
import VisRibbon from './VisRibbon';
import { isGlmFile } from '../utils/appUtils';
import { readJsonFile } from '../utils/fileProcessing';
import { NewEdgeForm } from './NewEdgeForm';
const { graphOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ANGLE = Math.PI / 12; // 15 degrees in radians

const Graph = ({ dataToVis, theme, isGlm, isCim, modelNumber, setSearchReqs }) => {
   const networkContainerRef = useRef(null);
   const layoutFormContainerRef = useRef(null);
   const legendContainerRef = useRef(null);
   const circularProgressRef = useRef(null);
   const GLIMPSE_OBJECT = { objects: [] };
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const edgeOptions = theme.edgeOptions;
   const counter = { value: -1 }; // counter to navigate through highlighted nodes
   const highlightedNodes = useRef([]);
   const highlightedEdges = useRef([]);

   let network = null; // global network variable
   let edgesToAnimate = {};
   let edgesToAnimateCount = 0;
   let redrawIntervalID = null;
   let createdClusterNodeGroups = {};

   let setNode = null;
   let setOpenNodePopup = null;
   let newNodeFormSetState = null;
   let contextMenuData = null;
   let setContextMenuData = null;
   let newEdgeFormSetState = null;
   let showRemoveOverlayBtn = null;

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
         node.label = node.id;

         return node;
      });

      const edgesToReset = graphData.edges.map((edge) => {
         const edgeType = edge.type;

         if (edgeTypes.includes(edgeType) || edgeType in edgeOptions) {
            if (edgeType === 'switch' && edge.attributes.status === 'OPEN') {
               edgeOptions[edgeType].arrows.middle.src = './imgs/switch-open.svg';
            } else if (edgeType === 'switch' && edge.attributes.status === 'CLOSED') {
               edgeOptions[edgeType].arrows.middle.src = './imgs/switch-closed.svg';
            }

            Object.assign(edge, edgeOptions[edgeType]);
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

   // initiate variables that reference the NodePopup child component state and set state variables

   /**
    * Used to send the set state function from the child to the parent
    * @param {React.Dispatch<React.SetStateAction<{}>>} setChildNode - The useState function of the NodePopup
    * child component
    * @param {React.Dispatch<React.SetStateAction<false>>} setOpen - Used to display the node popup form
    */
   const onChildMount = (setChildNode, setOpen) => {
      setNode = setChildNode;
      setOpenNodePopup = setOpen;
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

   const onVisRibbonMount = (showRmOvralyBtnSetter) => {
      showRemoveOverlayBtn = showRmOvralyBtnSetter;
   };

   const openNewNodeForm = (open) => {
      newNodeFormSetState(open);
   };
   const openNewEdgeForm = (open) => {
      newEdgeFormSetState(open);
   };

   /** close the node popup component */
   const closePopUp = () => {
      setOpenNodePopup(false);
   };

   /* ------------------------ End Receive Sate Variables from Children ------------------------ */

   /**
    * Updates the nodes's hover title with the new attributes
    * @param {Object} selectedNode - The node object that was selected to be edited
    */
   const saveEdits = (selectedNode) => {
      selectedNode.title = getHtmlTitle(selectedNode.attributes);
      graphData.nodes.update(selectedNode);
      setOpenNodePopup(false);
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
         'node',
         'load',
         'inverter',
         'capacitor',
         'diesel_dg',
         'triplex_meter',
         'triplex_node',
         'triplex_load',
         'microgrids',
         'communication_node'
      ]);

      const newNodes = [];
      const newEdges = [];

      for (const microGrid of microGrids) {
         const microGridNode = {
            id: microGrid.name,
            label: microGrid.name,
            group: 'microgrid',
            type: 'microgrid',
            title: `ObjectType: microgrid\nname: ${microGrid.name}`
         };

         newNodes.push(microGridNode);
         addedOverlayObjects.nodes.push(microGrid.name);
         objectTypeCount.nodes.microgrid++;

         const types = Object.keys(microGrid);

         for (const type of types) {
            if (!microGridNodeTypes.has(type)) continue;

            for (const nodeID of microGrid[type]) {
               const newEdgeID = `${microGrid.name}-${nodeID}`;

               const microGridEdge = {
                  id: newEdgeID,
                  from: microGrid.name,
                  to: nodeID,
                  title: getHtmlTitle({
                     objectType: 'microgrid_connection',
                     name: newEdgeID,
                     from: microGrid.name,
                     to: nodeID
                  }),
                  color: { inherit: true },
                  type: 'microgrid_connection',
                  width: 0.25
               };

               newEdges.push(microGridEdge);
               addedOverlayObjects.edges.push(newEdgeID);
               objectTypeCount.edges.microgrid_connection++;
            }
         }
      }

      if (topology) {
         for (const commNode of topology.Node) {
            let commNodeID = null;
            let mgNumber = null;

            if (typeof commNode.name === 'string') {
               commNodeID = commNode.name;
               mgNumber = parseInt(commNode.name.match(/\d+$/)[0], 10);
            } else {
               commNodeID = `comm${commNode.name + 1}`;
               mgNumber = commNode.name + 1;
            }

            newNodes.push({
               id: commNodeID,
               label: commNodeID,
               group: `communication_node`, // _${mgNumber}
               type: 'communication_node',
               title: getHtmlTitle({ objectType: 'communication_node', name: commNodeID })
            });

            addedOverlayObjects.nodes.push(commNodeID);
            objectTypeCount.nodes.communication_node++;

            let commEdgeID = `${commNodeID}-SS_${mgNumber}`;
            newEdges.push({
               id: commEdgeID,
               from: commNodeID,
               to: `SS_${mgNumber}`,
               title:
                  'objectType: parentChild\n' +
                  getHtmlTitle({
                     name: commEdgeID,
                     from: commNodeID,
                     to: `SS_${mgNumber}`
                  }),
               color: { inherit: true },
               type: 'communication',
               width: 2
            });

            addedOverlayObjects.edges.push(commEdgeID);
            objectTypeCount.edges.communication++;

            for (const connection of commNode.connections) {
               let to = null;

               if (typeof connection === 'string') {
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
                  title: getHtmlTitle({
                     objectType: 'parentChild',
                     name: commEdgeID,
                     from: commNodeID,
                     to: to
                  }),
                  color: { inherit: true },
                  type: 'communication',
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

      const microgridNodes = newNodes.filter((n) => n.type === 'microgrid').map((n) => n.id);

      for (const nodeID of network.body.nodeIndices) {
         if (network.clustering.isCluster(nodeID)) {
            for (const edgeID of network.getConnectedEdges(nodeID)) {
               if (
                  microgridNodes.includes(network.body.edges[edgeID].fromId) &&
                  network.body.edges[edgeID].toId === nodeID
               ) {
                  createdClusterNodeGroups[nodeID] =
                     `microgrid_${network.body.edges[edgeID].fromId}`;
                  network.clustering.updateClusteredNode(nodeID, {
                     group: `microgrid_${network.body.edges[edgeID].fromId}`
                  });

                  break;
               }
            }
         }
      }

      showRemoveOverlayBtn(true);
      network.setOptions({ physics: { enabled: true } });
      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   /**
    * Adds new nodes and edges based on the overlay json file data
    * @param {Object} fileData - the json object read from the file
    */
   const setOverlay = async (filePaths) => {
      if (filePaths.every((file) => isGlmFile(file))) {
         // sed file paths to be parsed and validated in the main process
         const data = await window.glimpseAPI.glm2json(filePaths);

         if (!data) {
            alert('Something went wrong... \n try re-uploading or reset the application app');
         } else if ('alert' in data) {
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
               edgeOptions,
               graphOptions
            );

            setLegendData(objectTypeCount, theme, edgeOptions, legendData);
         }
      } else {
         try {
            const fileDataPromise = await readJsonFile(filePaths[0]);
            const fileData = await fileDataPromise;

            await applyOverlay(fileData);
            showRemoveOverlayBtn(true);
         } catch (msg) {
            console.log(msg);
            alert('File may not be compatible... Check file and re-upload');
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
   const addNewNode = (newNodeObj) => {
      const { nodeType, nodeID, connectTo, edgeType } = newNodeObj;
      try {
         const newNodeCID = graphData.nodes.get(connectTo).communityID;
         const newNode = {
            id: nodeID,
            label: nodeID,
            type: nodeTypes[nodeType],
            group: nodeTypes[nodeType],
            communityID: newNodeCID,
            elementType: 'node',
            attributes: {
               id: `${nodeID}`
            }
         };

         newNode.title = getHtmlTitle({ ObjectType: nodeTypes[nodeType], ...newNode.attributes });
         objectTypeCount.nodes[newNode.type]++;

         graphData.nodes.add(newNode);

         const newEdge = {
            id: `${connectTo}-${newNode.id}`,
            to: connectTo,
            from: newNode.id,
            type: edgeTypes[edgeType],
            elementType: 'edge',
            color: edgeOptions[edgeTypes[edgeType]].color,
            width: edgeOptions[edgeTypes[edgeType]].width
         };

         const { color, width, elementType, type, ...rest } = newEdge;
         newEdge.title = getHtmlTitle({ ObjectType: edgeTypes[edgeType], ...rest });
         objectTypeCount.edges[newEdge.type]++;
         graphData.edges.add(newEdge);

         setLegendData(objectTypeCount, theme, edgeOptions, legendData);
      } catch (err) {
         console.error(err);
         // alert(`${nodeTypes[nodeType]}_${nodeID} already exists...`);
      }
   };

   const addNewEdge = (formObj) => {
      // "title" key is tooltip popup
      const newEdge = {
         id: formObj.edgeID,
         from: formObj.from,
         to: formObj.to,
         title: getHtmlTitle({
            ObjectType: formObj.edgeType,
            ID: formObj.edgeID,
            from: formObj.from,
            to: formObj.to
         }),
         animation: formObj.animate,
         type: formObj.edgeType,
         color: edgeOptions[formObj.edgeType].color,
         width: edgeOptions[formObj.edgeType].width
      };

      graphData.edges.add(newEdge);
      objectTypeCount.edges[formObj.edgeType]++;

      if (formObj.animate) {
         animateEdge(newEdge.id);
      }

      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const updateVisObjects = (updateData) => {
      console.log(`Updating ${updateData.elementType} with ID: ${updateData.id}`);
      console.log(updateData.updates);
      console.log('-------------------------------');

      if (updateData.elementType === 'node') {
         const node = graphData.nodes.get(updateData.id);

         if ('attributes' in updateData.updates) {
            const { attributes, ...rest } = updateData.updates;

            node.attributes = {
               ...node.attributes,
               ...attributes
            };

            node.title = getHtmlTitle(node.attributes);

            graphData.nodes.update({ ...node, ...rest });
            return;
         }

         // if ("group" in updateData.updates && updateData.updates.group === "defualt") {
         //    node.group = node.type;
         // }

         graphData.nodes.update({ ...node, ...updateData.updates });
      } else if (updateData.elementType === 'edge') {
         const edge = graphData.edges.get(updateData.id);
         const clusteredEdges = network.clustering.getClusteredEdges(edge.id);

         if ('animation' in updateData.updates) {
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
            return;
         } else if ('attributes' in updateData.updates) {
            const { attributes: updateAttributes, ...rest } = updateData.updates;

            edge.attributes = {
               ...edge.attributes,
               ...updateAttributes
            };

            edge.title = getHtmlTitle(edge.attributes);

            if (
               edge.type === 'switch' &&
               'status' in edge.attributes &&
               updateAttributes.status === 'TRIP'
            ) {
               edge.arrows.middle.src = './imgs/switch-open.svg';
               edge.attributes.status = 'OPEN';
            } else if (
               edge.type === 'switch' &&
               'status' in edge.attributes &&
               updateAttributes.status === 'CLOSED'
            ) {
               edge.attributes.status = 'CLOSED';
               edge.arrows.middle.src = './imgs/switch-closed.svg';
            }

            if (clusteredEdges.length > 1) {
               network.clustering.updateEdge(edge.id, { ...edge, ...rest });
            }

            graphData.edges.update({ ...edge, ...rest });
            return;
         }

         graphData.edges.update({ ...edge, ...updateData.updates });
      }
   };

   const animateEdges = (ctx) => {
      if (edgesToAnimateCount === 0) return;

      let start = null;
      let end = null;

      try {
         for (const edgeID in edgesToAnimate) {
            const edge = edgesToAnimate[edgeID];
            const canvasEdge = network.body.edges[edgeID];

            if (!canvasEdge) continue;

            if (edge.startFrom === 'target') {
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
            const sideLength = 8.5; // Base width of the triangle
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
            ctx.strokeStyle = 'black';
            ctx.stroke();
            ctx.fillStyle = 'orange';
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
   };

   const removeEdgeAnimation = (edgeID) => {
      delete edgesToAnimate[edgeID];
      edgesToAnimateCount--;

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
    * @param {float} incrementValue An increment value between 0.1 - 0.001 to determine the animation's speed (default: 0.01)
    * @param {string} startFrom start the animation of an edge from its `"source"` or `"target"`
    */
   const animateEdge = (edgeID, incrementValue = 0.01, startFrom = 'source') => {
      if (incrementValue === undefined) incrementValue = 0.01;
      if (startFrom === undefined) startFrom = 'source';

      console.log(`Animating edge: ${edgeID}`);

      try {
         // if the edge to animate is a clustered edge animate as normal
         if (edgeID.includes('clusterEdge') && !(edgeID in edgesToAnimate)) {
            edgesToAnimate[edgeID] = {
               position: 0,
               increment: incrementValue,
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
               increment: incrementValue,
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
               increment: incrementValue,
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

      console.log('DELETED: ' + nodeID);

      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const deleteEdge = (edgeID) => {
      // check if the edgeID is a cluster edge ID
      if (edgeID.includes('clusterEdge')) {
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
      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   /**
    * Hides the legend container and shows the vis.js layout options form
    */
   const toggleVisOptions = () => {
      if (
         layoutFormContainerRef.current.style.display === 'none' ||
         layoutFormContainerRef.current.style.display === ''
      ) {
         networkContainerRef.current.style.width = '72%';
         layoutFormContainerRef.current.style.display = 'flex';
         legendContainerRef.current.style.display = 'none';
      } else {
         if (networkContainerRef.current.style.width === '30%') {
            networkContainerRef.current.style.width = '72%';
         }
         layoutFormContainerRef.current.style.display = 'none';
         legendContainerRef.current.style.display = 'block';
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

      addedOverlayObjects.nodes = [];
      addedOverlayObjects.edges = [];

      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   /**
    * Applies the node and edge styes from the them builder component and updates the legend
    * @param {Object} newStyles
    * @param {Object} newStyles.newNodeStyles
    * @param {Object} newStyles.newEdgeStyles
    */
   const applyTheme = ({ newNodeStyles, newEdgeStyles }) => {
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

      setLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const createClusterNode = (clusterValue) => {
      if (typeof clusterValue === 'number') clusterValue = `CID_${clusterValue}`;

      network.cluster({
         joinCondition: (childOptions) => {
            if (typeof childOptions.communityID === 'number')
               return `CID_${childOptions.communityID}` === clusterValue;

            // if the communityID is a string then it has a cluster value of CID_[n]
            return childOptions.communityID === clusterValue;
         },
         processProperties: (clusterOptions, childNodes, childEdges) => {
            clusterOptions.value = childNodes.length;
            clusterOptions.title = `Nodes in Community: ${childNodes.length}`;
            clusterOptions.mass = childNodes.length * 0.1;
            return clusterOptions;
         },
         clusterNodeProperties: {
            id: clusterValue,
            borderWidth: 2,
            shape: 'hexagon',
            label: clusterValue,
            group:
               clusterValue in createdClusterNodeGroups
                  ? createdClusterNodeGroups[clusterValue]
                  : 'clusterNode',
            type: 'clusterNode'
         }
      });

      const clusterNode = network.body.nodes[clusterValue];

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
      if (edgesToAnimateCount > 0) {
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
         window.glimpseAPI.onExtract(() => Export(graphData, isGlm, dataToVis))
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
            if (newNodeData.objectType in objectTypeCount) {
               objectTypeCount[newNodeData.objectType]++;
               setLegendData(objectTypeCount, theme, edgeOptions, legendData);
            }

            graphData.nodes.add({
               id: newNodeData.attributes.id,
               attributes: newNodeData.attributes,
               group: newNodeData.objectType,
               title: getHtmlTitle({ type: newNodeData.objectType, ...newNodeData.attributes }),
               ...newNodeData.styles
            });
         })
      );

      removeListenerArr.push(
         window.glimpseAPI.onAddEdgeEvent((newEdgeData) => {
            graphData.edges.add([
               {
                  id: newEdgeData.attributes.id,
                  to: newEdgeData.attributes.to,
                  from: newEdgeData.attributes.from,
                  attributes: newEdgeData.attributes,
                  title: getHtmlTitle({
                     type: newEdgeData.objectType,
                     ...newEdgeData.attributes
                  }),
                  ...newEdgeData.styles
               }
            ]);
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

         graphOptions.physics.solver = 'barnesHut';
         graphOptions.layout.hierarchical.enabled = false;
         graphOptions.physics.stabilization.enabled = true;
         graphOptions.physics.enabled = true;
      };
   });
   /* ---- End Establish Listeners Between Main process and renderer process --- */

   /* --------------------------- visualization hook --------------------------- */
   useEffect(() => {
      const circularProgressBar = document.getElementById('circularProgress');
      const circularProgressValue = document.getElementById('progressValue');
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
         edgeOptions,
         graphOptions
      );
      /* ---------------------------- Establish Network --------------------------- */
      setLegendData(objectTypeCount, theme, edgeOptions, legendData);

      console.log('Number of Nodes: ' + graphData.nodes.length);
      console.log('Number of Edges: ' + graphData.edges.length);

      /* ------------------ Receive Sate Variables from Children ------------------ */

      const establishNetworkxGraph = async (data) => {
         try {
            const res = await axios.post('http://127.0.0.1:5173/create-nx-graph', data, {
               headers: 'application/json'
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
         let communityIDsSet = null;

         if (graphData.nodes.length >= 2800) {
            // This will result in a array of unique community IDs and establish the networkx object in server
            communityIDsSet = await establishNetworkxGraph([GLIMPSE_OBJECT, true]);
            establishCommunities = true;
            graphOptions.physics.barnesHut.damping = 0.7;
         } else {
            // this will create and establish the networkx GRAPH object in the
            establishNetworkxGraph(GLIMPSE_OBJECT);
         }

         // If the nodes contain x,y then no need runt he stabilization code
         if ('x' in graphData.nodes.get()[0] && 'y' in graphData.nodes.get()[0]) {
            graphOptions.physics.enabled = false;
            graphOptions.groups = theme.groups;
            circularProgressBar.style.display = 'none';
            network = new Network(networkContainerRef.current, graphData, graphOptions);
         } else {
            if (
               graphData.nodes.length > 151 &&
               graphData.nodes.length <= 300 &&
               graphData.edges.length >= 7000
            ) {
               graphOptions.physics.solver = 'forceAtlas2Based';
            }

            graphOptions.groups = theme.groups;
            network = new Network(networkContainerRef.current, graphData, graphOptions);

            // Create clusters
            if (establishCommunities) {
               network.setOptions({ physics: { barnesHut: { springLength: 140 } } });
               communityIDsSet.forEach((CID) => createClusterNode(CID));
            }

            network.on('stabilizationProgress', (params) => {
               circularProgressBar.style.display = 'flex';
               /* Math for determining the radius of the circular progress bar based on the stabilization progress */
               const maxWidth = 360;
               const minWidth = 1;
               const widthFactor = params.iterations / params.total;
               const width = Math.max(minWidth, maxWidth * widthFactor);
               circularProgressBar.style.background = `conic-gradient(#45AB48 ${width}deg, #333333 0deg)`;
               circularProgressValue.innerText = `${Math.round(widthFactor * 100)}%`;
            });

            network.once('stabilizationIterationsDone', () => {
               /* Once stabilization is done the circular progress with display 100% for half a second then hide */
               circularProgressBar.style.background =
                  'conic-gradient(#45AB48 360deg, #333333 0deg)';
               circularProgressValue.innerText = '100%';
               circularProgressBar.style.opacity = 0.7;

               /* set physics to false for better performance when stabilization is done */
               network.setOptions({ physics: { enabled: false } });

               setTimeout(() => {
                  circularProgressBar.style.display = 'none';
               }, 500);
            });
         }

         network.on('doubleClick', (params) => {
            if (params.nodes[0] === undefined) {
               alert('Double click on a node to edit.');
            } else {
               /* Set the state of the NodePopup component for editing of the selected node's attributes */
               setNode(graphData.nodes.get(params.nodes[0]));
               setOpenNodePopup(true);
            }
         });

         /* Display the child Context menu component to hide an edge or edge types */
         network.on('oncontext', (params) => {
            const contextNodeID = network.getNodeAt(params.pointer.DOM);
            const contextEdgeID = network.getEdgeAt(params.pointer.DOM);

            if (contextEdgeID && !contextNodeID) {
               setContextMenuData({
                  edgeID: contextEdgeID
               });
            } else if (contextNodeID && !network.clustering.isCluster(contextNodeID)) {
               const nodeData = graphData.nodes.get(contextNodeID);

               if ('communityID' in nodeData) {
                  setContextMenuData({
                     nodeID: nodeData.id,
                     CID: nodeData.communityID
                  });

                  return;
               }

               setContextMenuData({
                  nodeID: nodeData.id
               });
            } else if (contextNodeID && network.clustering.isCluster(contextNodeID)) {
               setContextMenuData({
                  clusterNodeID: contextNodeID
               });
            } else {
               setContextMenuData({});
            }
         });

         network.on('afterDrawing', (ctx) => animateEdges(ctx));

         network.on('selectEdge', (params) => console.log(network.body.edges[params.edges[0]]));
         network.on('selectNode', (params) => console.log(network.body.nodes[params.nodes[0]]));

         network.setOptions({
            configure: {
               filter: (option, path) => {
                  if (path.indexOf('physics') !== -1) return true;
                  if (path.indexOf('smooth') !== -1 || option === 'smooth') return true;

                  return false;
               },
               container: layoutFormContainerRef.current
            }
         });
      };

      setSearchReqs({
         graphData: graphData,
         findNode: (node) => nodeFocus(node, network),
         findEdge: (edge) => edgeFocus(edge, network),
         applyOverlay: applyOverlay
      });

      initializeGraph();

      return () => {
         if (redrawIntervalID) {
            clearInterval(redrawIntervalID);
            redrawIntervalID = null;
         }
         currentUploadCounter.value = 0;
         graphData.nodes.clear();
         graphData.edges.clear();
         legendData.edges.clear();
         legendData.nodes.clear();
      };
   }, []);
   /* ------------------------- End visualization hook ------------------------- */

   return (
      <>
         <VisRibbon
            reset={Reset}
            setOverlay={setOverlay}
            onMount={onVisRibbonMount}
            physicsToggle={TogglePhysics}
            removeOverlay={removeOverlay}
            legendContainerRef={legendContainerRef}
            circularProgressRef={circularProgressRef}
            rotateCW={() => rotateCW(network, ANGLE)}
            networkContainerRef={networkContainerRef}
            layoutContainerRef={layoutFormContainerRef}
            rotateCCW={() => rotateCCW(network, ANGLE)}
            prev={() => Prev(network, highlightedNodes, counter)}
            next={() => Next(network, highlightedNodes, counter)}
         />

         <Stack sx={{ height: 'calc(100% - 8.6rem)', width: '100%' }} direction={'row'}>
            <Box
               sx={{ width: '72%', height: '100%' }}
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
                     edgeOptions,
                     highlightedEdges
                  )
               }
               hideObjects={(objType, type) => hideObjects(objType, type, graphData)}
               legendData={legendData}
               visTheme={theme}
               applyTheme={applyTheme}
               legendContainerRef={legendContainerRef}
            />

            <Box sx={{ display: 'none', width: '32.5rem' }} ref={layoutFormContainerRef} />
         </Stack>

         <div ref={circularProgressRef} id="circularProgress">
            <span id="progressValue">0%</span>
         </div>

         <NodePopup onMount={onChildMount} onSave={saveEdits} close={closePopUp} />

         <ContextMenu
            onMount={onContextMenuChildMount}
            hideEdge={(id) => hideEdge(id, graphData)}
            hideEdges={(type) => hideEdges(type, graphData)}
            openNewNodeForm={openNewNodeForm}
            openNewEdgeForm={openNewEdgeForm}
            deleteNode={deleteNode}
            createCluster={createClusterNode}
            openCluster={(id) => deCluster(id)}
            animateEdge={animateEdge}
            removeAnimation={removeEdgeAnimation}
            isEdgeAnimated={(id) => id in edgesToAnimate}
            deleteEdge={deleteEdge}
            networkContainerRef={networkContainerRef}
         />

         <NewNodeForm
            onMount={onNewNodeFormMount}
            nodes={() => graphData.nodes.getIds()}
            addNode={addNewNode}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
         />

         <NewEdgeForm
            onMount={onNewEdgeFormMount}
            nodes={() => graphData.nodes.getIds()}
            edgeTypes={Object.keys(objectTypeCount.edges).filter(
               (key) => objectTypeCount.edges[key] > 0
            )}
            createEdge={addNewEdge}
         />
      </>
   );
};

export default Graph;
