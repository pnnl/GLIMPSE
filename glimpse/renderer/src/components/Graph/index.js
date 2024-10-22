import { Box, Stack } from "@mui/material";
import axios from "axios";
import React, { useEffect, useRef } from "react";
import { DataSet } from "vis-data";
import { Network } from "vis-network";
import "./Graph.css";
import "../../other-styles/vis-network.css";
import {
   currentUploadCounter,
   Export,
   getLegendData,
   getTitle,
   hideEdge,
   hideEdges,
   hideObjects,
   HighlightEdges,
   HighlightGroup,
   Next,
   NodeFocus,
   Prev,
   rotateCCW,
   rotateCW,
   setGraphData,
   showAttributes,
   updateVisObjects,
} from "../../utils/graphUtils";
import ActionDrawer from "../ActionDrawer";
import ContextMenu from "../ContextMenu";
import Legend from "../Legend";
import NewNodeForm from "../NewNodeForm";
import NodePopup from "../NodePopup";
import VisActionsDial from "../VisActionsDial";
import { isGlmFile } from "../../utils/appUtils";
import { readJsonFile } from "../../utils/fileProcessing";
import { NewEdgeForm } from "../NewEdgeForm/Index";
const { graphOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ANGLE = Math.PI / 12; // 15 degrees in radians

const Graph = ({ dataToVis, theme, isGlm }) => {
   const container = useRef(null);
   const GLIMPSE_OBJECT = { objects: [] };
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const edgeOptions = theme.edgeOptions;
   const counter = { value: -1 }; // counter to navigate through highlighted nodes
   const highlightedNodes = useRef([]);
   const highlightedEdges = useRef([]);
   let glmNetwork = null; // global network variable

   const addedOverlayObjects = {
      nodes: [],
      edges: [],
   };

   // data object that holds a DataSet for nodes and edges
   const graphData = {
      nodes: new DataSet(),
      edges: new DataSet(),
   };

   const legendData = {
      nodes: new DataSet(),
      edges: new DataSet(),
   };

   // used to keep count of each object type
   const objectTypeCount = {
      nodes: Object.keys(theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
      edges: Object.keys(theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
   };

   objectTypeCount.edges.parentChild = 0;

   /**
    * Reset all nodes and edges back to their original styles
    */
   const Reset = () => {
      highlightedNodes.current.length = 0;
      highlightedEdges.current.length = 0;
      const nodesResetMap = graphData.nodes.map((node) => {
         delete node.size;
         delete node.color;
         delete node.shape;
         node.hidden = false;
         node.label = node.id;

         return node;
      });

      const edgeItems = graphData.edges.map((edge) => {
         const edgeType = edge.type;

         if (edgeTypes.includes(edgeType) || edgeType in edgeOptions) {
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

      glmNetwork.setOptions({ groups: theme.groups });
      graphData.nodes.update(nodesResetMap);
      graphData.edges.update(edgeItems);
      glmNetwork.fit();
      counter.value = -1;
   };

   /**
    * Turns physics on or off
    * @param {bool} toggle - True turns on physics, false turns off physics
    */
   const TogglePhysics = (toggle) => {
      if (toggle) glmNetwork.setOptions({ physics: { enabled: true } });
      else glmNetwork.setOptions({ physics: { enabled: false } });
   };

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
   getLegendData(objectTypeCount, theme, edgeOptions, legendData);

   console.log("Number of Nodes: " + graphData.nodes.length);
   console.log("Number of Edges: " + graphData.edges.length);

   /* ------------------ Receive Sate Variables from Children ------------------ */

   // initiate variables that reference the NodePopup child component state and set state variables
   let seNode;
   let setOpenNodePopup;
   /**
    * Used to send the set state function from the child to the parent
    * @param {React.Dispatch<React.SetStateAction<{}>>} setChilNode - The useState function of the NodePopup child component
    * @param {React.Dispatch<React.SetStateAction<false>>} setOpen - Used to display the node popup form
    */
   const onChildMount = (setChilNode, setOpen) => {
      seNode = setChilNode;
      setOpenNodePopup = setOpen;
   };

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
   };

   let newNodeFormSetState;
   const onNewNodeFormMount = (setOpenNewNodeForm) => {
      newNodeFormSetState = setOpenNewNodeForm;
   };

   let newEdgeFormSetState;
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
      setOpenNodePopup(false);
   };

   /* ------------------------ End Recive Sate Variables from Children ------------------------ */

   /**
    * Updates the nodes's hover title with the new attributes
    * @param {Object} selectedNode - The node object that was selected to be edited
    */
   const saveEdits = (selectedNode) => {
      selectedNode.title = getTitle(selectedNode.attributes);
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
            mouseY: e.clientY + 6,
         });
      } else {
         setContextMenuData(null);
      }
   };

   /**
    * Adds new nodes and edges based on the overlay json file data
    * @param {Object} fileData - the json object read from the file
    */
   const attachOverlay = async (filePaths, showRemoveOverlayButton) => {
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
               edgeOptions,
               graphOptions
            );

            getLegendData(objectTypeCount, theme, edgeOptions, legendData);
         }
      } else {
         try {
            const fileData = await readJsonFile(filePaths[0]);

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
               "communication_node",
            ];

            for (const microgrid of microgrids) {
               addedOverlayObjects.nodes.push(
                  graphData.nodes.add({
                     id: microgrid.name,
                     label: microgrid.name,
                     group: "microgrid",
                     title: `ObjectType: microgrid\nname: ${microgrid.name}`,
                  })[0]
               );

               objectTypeCount.nodes.microgrid++;

               for (const type of Object.keys(microgrid)) {
                  if (types.includes(type)) {
                     microgrid[type].forEach((nodeID) => {
                        addedOverlayObjects.edges.push(
                           graphData.edges.add({
                              id: `${microgrid.name}-${nodeID}`,
                              from: microgrid.name,
                              to: nodeID,
                              title: `objectType: parentChild\nname: ${microgrid.name}-${nodeID}\nfrom: ${microgrid.name}\nto: ${nodeID}`,
                              color: { inherit: true },
                              type: "parentChild",
                              width: 0.15,
                           })[0]
                        );
                     });

                     objectTypeCount.edges.parentChild++;
                  }
               }
            }

            if (communication_nodes) {
               for (const comm_node of communication_nodes) {
                  addedOverlayObjects.nodes.push(
                     graphData.nodes.add({
                        id: comm_node.name,
                        label: comm_node.name,
                        group: "communication_node",
                        title: `ObjectType: communication_node\nname: ${comm_node.name}`,
                     })[0]
                  );

                  objectTypeCount.nodes.communication_node++;

                  for (const type of Object.keys(comm_node)) {
                     if (types.includes(type)) {
                        comm_node[type].forEach((nodeID) => {
                           addedOverlayObjects.edges.push(
                              graphData.edges.add({
                                 id: `${comm_node.name}-${nodeID}`,
                                 from: comm_node.name,
                                 to: nodeID,
                                 title: `objectType: parentChild\nname: ${comm_node.name}-${nodeID}\nfrom: ${comm_node.name}\nto: ${nodeID}`,
                                 type: "parentChild",
                                 color: { inherit: true },
                                 width: 0.15,
                              })[0]
                           );
                        });

                        objectTypeCount.edges.parentChild++;
                     }
                  }
               }
            }

            showRemoveOverlayButton("flex");
            getLegendData(objectTypeCount, theme, edgeOptions, legendData);
         } catch (msg) {
            console.log(msg);
            alert("File currently not compatible... Check file and re-upload");
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
      const node_types = Object.keys(objectTypeCount.nodes).filter(
         (key) => objectTypeCount.nodes[key] > 0
      );
      const edge_types = Object.keys(objectTypeCount.edges).filter(
         (key) => objectTypeCount.edges[key] > 0
      );

      try {
         const nodesOfsameType = graphData.nodes
            .get()
            .filter((n) => n.group === node_types[nodeType]);

         const [addedNodeID] = graphData.nodes.add({
            id: `${nodeID}`,
            label: `${nodeID}`,
            group: node_types[nodeType],
            attributes: {
               id: `${nodeID}`,
            },
            level:
               "level" in nodesOfsameType[0].attributes
                  ? nodesOfsameType[0].attributes.level
                  : undefined,
         });

         const addedNode = graphData.nodes.get(addedNodeID);
         addedNode.title =
            "Object Type: " + node_types[nodeType] + "\n" + getTitle(addedNode.attributes);
         objectTypeCount.nodes[addedNode.group]++;
         graphData.nodes.update(addedNode);

         const [addedEdgeID] = graphData.edges.add({
            id: `${connectTo}-${addedNodeID}`,
            from: connectTo,
            to: addedNodeID,
            type: edge_types[edgeType],
            color: edgeOptions[edge_types[edgeType]].color,
            width: edgeOptions[edge_types[edgeType]].width,
         });

         const { color, width, ...rest } = graphData.edges.get(addedEdgeID);
         const addedEdge = graphData.edges.get(addedEdgeID);
         addedEdge.title = `Object Type: ${edge_types[edgeType]}\n${getTitle(rest)}`;
         objectTypeCount.edges[addedEdge.type]++;
         graphData.edges.update(addedEdge);

         getLegendData(objectTypeCount, theme, edgeOptions, legendData);
      } catch (err) {
         alert(`${node_types[nodeType]}_${nodeID} already exists...`);
      }
   };

   const addNewEdge = (formObj) => {
      const newEdge = {
         id: formObj.edgeID,
         from: formObj.from,
         to: formObj.to,
         // title is tooltip popup
         title: `Object Type: ${formObj.edgeType}\nID: ${formObj.edgeID}\nFrom: ${formObj.from}\nTo: ${formObj.to}`,
         type: formObj.edgeType,
         color: edgeOptions[formObj.edgeType].color,
         width: edgeOptions[formObj.edgeType].width,
      };

      graphData.edges.add(newEdge);
      graphData.edges.update({ ...newEdge, attributes: { animation: formObj.animate } });
      objectTypeCount.edges[formObj.edgeType]++;
      getLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const animateEdge = (edgeID) => {
      const edgeToAnimate = graphData.edges.get(edgeID);
      edgeToAnimate.attributes.animation = true;

      graphData.edges.update(edgeToAnimate);
   };

   /**
    * Delete a node along with the edges connected to it and updating the legend
    * @param {string} nodeID the ID of a node to delete
    */
   const deleteNode = (nodeID) => {
      // get node obj and subtract from that node type's count
      objectTypeCount.nodes[graphData.nodes.get(nodeID).group]--;

      const edgesToDelete = [];
      for (let edge of graphData.edges.get()) {
         if (edge.from === nodeID || edge.to === nodeID) {
            edgesToDelete.push(edge.id);
            objectTypeCount.edges[edge.type]--;
         }
      }

      graphData.nodes.remove(nodeID);
      graphData.edges.remove(edgesToDelete);

      getLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const deleteEdge = (edgeID) => {
      const edgeToDelete = graphData.edges.get(edgeID);
      console.log(edgeToDelete);
      objectTypeCount.edges[edgeToDelete.type]--;
      graphData.edges.remove(edgeID);

      getLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   /**
    * Hides the legend container and shows the vis.js layout options form
    */
   const toggleVisOptions = () => {
      const legend = document.getElementById("legend-network");
      const layoutForm = document.getElementById("layout-form");
      const graph = document.getElementById("graph");

      if (layoutForm.style.display === "none" || layoutForm.style.display === "") {
         graph.style.width = "72%";
         layoutForm.style.display = "flex";
         legend.style.display = "none";
      } else {
         if (graph.style.width === "30%") {
            graph.style.width = "72%";
         }
         layoutForm.style.display = "none";
         legend.style.display = "block";
      }
   };

   /**
    * Removes all nodes and edges added through the overlay upload feature
    * and updates the legend
    */
   const removeOverlay = () => {
      graphData.nodes.get(addedOverlayObjects.nodes).forEach((node) => {
         objectTypeCount.nodes[node.group]--;
      });

      graphData.edges.get(addedOverlayObjects.edges).forEach((edge) => {
         objectTypeCount.edges[edge.type]--;
      });
      graphData.nodes.remove(addedOverlayObjects.nodes);
      graphData.edges.remove(addedOverlayObjects.edges);

      addedOverlayObjects.nodes.length = 0;
      addedOverlayObjects.edges.length = 0;

      getLegendData(objectTypeCount, theme, edgeOptions, legendData);
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
      glmNetwork.setOptions({ groups: theme.groups });

      const { type, ...restOfEdgeStyles } = newEdgeStyles;
      theme.edgeOptions[type] = restOfEdgeStyles;

      graphData.edges.update(
         graphData.edges.map((edge) => {
            if (edge.type === type) {
               edge = {
                  ...edge,
                  ...restOfEdgeStyles,
               };
            }
            return edge;
         })
      );

      getLegendData(objectTypeCount, theme, edgeOptions, legendData);
   };

   const createClusterNode = (clusterValue) => {
      glmNetwork.cluster({
         joinCondition: (childOptions) => {
            return childOptions.communityID === clusterValue;
         },
         processProperties: (clusterOptions, childNodes, childEdges) => {
            clusterOptions.value = childNodes.length;
            clusterOptions.title = `Nodes in Community: ${childNodes.length}`;
            clusterOptions.mass = childNodes.length;
            return clusterOptions;
         },
         clusterNodeProperties: {
            id: clusterValue,
            borderWidth: 3,
            shape: "hexagon",
            label: `Community-${clusterValue}`,
            group: clusterValue,
         },
      });
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
         window.glimpseAPI.onUpdateData((updateData) => updateVisObjects(updateData, graphData))
      );
      removeListenerArr.push(
         window.glimpseAPI.onAddNodeEvent((newNodeData) => {
            graphData.nodes.add({
               id: newNodeData.attributes.id,
               attributes: newNodeData.attributes,
               title: "Type: " + newNodeData.objectType + "\n" + getTitle(newNodeData.attributes),
               ...newNodeData.styles,
            });
         })
      );
      removeListenerArr.push(
         window.glimpseAPI.onAddEdgeEvent((newEdgeData) => {
            graphData.edges.add({
               id: newEdgeData.id,
               to: newEdgeData.attributes.to,
               from: newEdgeData.attributes.from,
               attributes: newEdgeData.attributes,
               title: "Type: " + newEdgeData.objectType + "\n" + getTitle(newEdgeData.attributes),
               ...newEdgeData.styles,
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
      let intervalID = null;
      let establishCommunities = false;

      const establishNetworkxGraph = async (data) => {
         try {
            const res = await axios.post("http://127.0.0.1:5051/create-nx-graph", data, {
               headers: "application/json",
            });

            if (res.status === 200) {
               const communityIDs = res.data;
               const updatedNodes = graphData.nodes.map((node) => {
                  node.communityID = communityIDs[node.id];
                  return node;
               });

               graphData.nodes.update(updatedNodes);
               return [...new Set(graphData.nodes.map((node) => node.communityID))];
            }
         } catch (err) {
            console.log(err);
         }
      };

      const initializeGraph = async () => {
         let communityIDsSet = null;

         if (graphData.nodes.length >= 2500) {
            // This will result in a array of unique community IDs and establish the networkx object in server
            communityIDsSet = await establishNetworkxGraph([GLIMPSE_OBJECT, true]);
            establishCommunities = true;
            graphOptions.physics.barnesHut.damping = 0.7;
         } else {
            // this will create and establish the networkx object in the
            establishNetworkxGraph(GLIMPSE_OBJECT);
         }

         // If the nodes contain x,y then no need runt he stabilization code
         if ("x" in graphData.nodes.get()[0] && "y" in graphData.nodes.get()[0]) {
            graphOptions.physics.enabled = false;
            graphOptions.groups = theme.groups;
            circularProgressBar.style.display = "none";
            glmNetwork = new Network(container.current, graphData, graphOptions);
         } else {
            if (
               graphData.nodes.length > 151 &&
               graphData.nodes.length <= 300 &&
               graphData.edges.length >= 7000
            ) {
               graphOptions.physics.solver = "forceAtlas2Based";
            }

            graphOptions.groups = theme.groups;
            glmNetwork = new Network(container.current, graphData, graphOptions);

            // Create clusters
            if (establishCommunities) {
               for (let communityID of communityIDsSet) createClusterNode(communityID);
            }

            // get the list of edges that contain the animation value of true
            const edgesToAnimate = graphData.edges
               .get()
               .filter((edge) => edge.attributes.animation);

            if (edgesToAnimate.length > 0) {
               intervalID = setInterval(() => {
                  glmNetwork.redraw();
               }, 10);
            }

            // animate edges if there are any
            // create an object for the positions of each moving circle for each edge
            const positions = edgesToAnimate.reduce(
               (previousObj, edge) => ({ ...previousObj, [edge.id]: 0 }),
               {}
            );

            // Event listener to draw the moving circle
            glmNetwork.on("afterDrawing", (ctx) => {
               if (edgesToAnimate.length > 0) {
                  for (let edge of edgesToAnimate) {
                     const canvasEdge = glmNetwork.body.edges[edge.id];
                     const { from: start, to: end } = canvasEdge;

                     // Calculate the circle's position along the edge
                     positions[edge.id] += 0.01;
                     if (positions[edge.id] > 1) {
                        positions[edge.id] = 0;
                     }

                     const x = start.x * (1 - positions[edge.id]) + end.x * positions[edge.id];
                     const y = start.y * (1 - positions[edge.id]) + end.y * positions[edge.id];

                     // Draw the circle
                     ctx.beginPath();
                     ctx.arc(x, y, 5, 0, 2 * Math.PI);
                     ctx.fillStyle = "red";
                     ctx.fill();
                  }
                  // Redraw the network at set intervals to create the animation
               }
            });

            glmNetwork.on("selectEdge", (params) => {
               console.log(params);
               console.log("\n\n", glmNetwork.body.edges[params.edges[0]]);
            });

            graphData.edges.on("update", (event, props, senderId) => {
               const updatedEdge = graphData.edges.get(props.items[0]);
               const animateEdge =
                  "animation" in updatedEdge.attributes && updatedEdge.attributes.animation;

               if (animateEdge && !edgesToAnimate.some((edge) => edge.id === updatedEdge.id)) {
                  edgesToAnimate.push(updatedEdge);
                  positions[updatedEdge.id] = 0;

                  if (!intervalID) {
                     intervalID = setInterval(() => {
                        glmNetwork.redraw();
                     }, 10);
                  }
               } else if (
                  !animateEdge &&
                  edgesToAnimate.some((edge) => edge.id === updatedEdge.id)
               ) {
                  const edgeIndex = edgesToAnimate.findIndex((edge) => edge.id === updatedEdge.id);
                  edgesToAnimate.slice(edgeIndex, 1);
                  delete positions[updatedEdge.id];
               }
            });

            glmNetwork.on("selectNode", (params) => {
               if (params.nodes.length === 1) {
                  if (glmNetwork.isCluster(params.nodes[0]) === true) {
                     glmNetwork.openCluster(params.nodes[0]);
                  }
               }
            });

            glmNetwork.on("stabilizationProgress", (params) => {
               circularProgressBar.style.display = "flex";
               /* Math for determining the radius of the circular progress bar based on the stabilization progress */
               const maxWidth = 360;
               const minWidth = 1;
               const widthFactor = params.iterations / params.total;
               const width = Math.max(minWidth, maxWidth * widthFactor);
               circularProgressBar.style.background = `conic-gradient(#45AB48 ${width}deg, #333 0deg)`;
               circularProgressValue.innerText = Math.round(widthFactor * 100) + "%";
            });

            glmNetwork.once("stabilizationIterationsDone", () => {
               /* Once stabilization is done the circular progress with display 100% for half a second then hide */
               circularProgressBar.style.background = "conic-gradient(#45AB48 360deg, #333 0deg)";
               circularProgressValue.innerText = "100%";
               circularProgressBar.style.opacity = 0.7;

               /* set physics to false for better performance when stabilization is done */
               glmNetwork.setOptions({ physics: { enabled: false } });

               setTimeout(() => {
                  circularProgressBar.style.display = "none";
               }, 500);
            });
         }

         glmNetwork.on("doubleClick", (params) => {
            if (params.nodes[0] === undefined) {
               alert("Double click on a node to edit.");
            } else {
               /* Set the state of the NodePopup component for editing of the selected node's attributes */
               seNode(graphData.nodes.get(params.nodes[0]));
               setOpenNodePopup(true);
            }
         });

         /* Display the child Context menu component to hide an edge or edge types */
         glmNetwork.on("oncontext", (params) => {
            const contextNodeID = glmNetwork.getNodeAt(params.pointer.DOM);
            const contextEdgeID = glmNetwork.getEdgeAt(params.pointer.DOM);

            if (contextEdgeID && !contextNodeID) {
               setContextMenuData({
                  edgeID: contextEdgeID,
               });
            } else if (contextNodeID && !glmNetwork.clustering.isCluster(contextNodeID)) {
               const nodeData = graphData.nodes.get(contextNodeID);

               if ("communityID" in nodeData) {
                  setContextMenuData({
                     nodeID: nodeData.id,
                     CID: nodeData.communityID,
                  });
               } else {
                  setContextMenuData({
                     nodeID: nodeData.id,
                  });
               }
            } else {
               setContextMenuData({});
            }
         });

         glmNetwork.setOptions({
            configure: {
               filter: (option, path) => {
                  if (path.indexOf("physics") !== -1) return true;
                  if (path.indexOf("smooth") !== -1 || option === "smooth") return true;

                  return false;
               },
               container: document.getElementById("layout-form"),
            },
            nodes: {
               scaling: {
                  min: 5,
                  max: 75,
               },
            },
            edges: {
               scaling: {
                  min: 5,
                  max: 20,
               },
            },
         });
      };

      initializeGraph();

      return () => {
         if (intervalID) clearInterval(intervalID);
         currentUploadCounter.value = 0;
      };
   }, []);
   /* ------------------------- End visualization hook ------------------------- */

   return (
      <div className="vis-wrapper">
         <NodePopup onMount={onChildMount} onSave={saveEdits} close={closePopUp} />

         <NewEdgeForm
            onMount={onNewEdgeFormMount}
            nodes={() => graphData.nodes.getIds()}
            edgeTypes={Object.keys(objectTypeCount.edges).filter(
               (key) => objectTypeCount.edges[key] > 0
            )}
            createEdge={addNewEdge}
         />

         <NewNodeForm
            onMount={onNewNodeFormMount}
            nodes={() => graphData.nodes.getIds()}
            addNode={addNewNode}
            nodeTypes={Object.keys(objectTypeCount.nodes).filter(
               (key) => objectTypeCount.nodes[key] > 0
            )}
            edgeTypes={Object.keys(objectTypeCount.edges).filter(
               (key) => objectTypeCount.edges[key] > 0
            )}
         />

         <div id="circularProgress">
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
            animateEdge={animateEdge}
            deleteEdge={deleteEdge}
         />

         <ActionDrawer
            findNode={(id) => NodeFocus(graphData.nodes.get(id), glmNetwork)}
            getNodeIds={() => graphData.nodes.getIds()}
            physicsToggle={TogglePhysics}
            attachOverlay={attachOverlay}
            removeOverlay={removeOverlay}
            reset={Reset}
         />

         <Stack sx={{ height: "100%", width: "100%" }} direction={"row"}>
            <Box
               id="graph"
               component={"div"}
               sx={{ width: "72%", height: "100%" }}
               ref={container}
               onContextMenu={handleContextmenu}
            />

            <div id="layout-form" />

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
            />
         </Stack>

         <VisActionsDial
            rotateCW={() => rotateCW(graphData, glmNetwork, ANGLE)}
            rotateCCW={() => rotateCCW(graphData, glmNetwork, ANGLE)}
            prev={() => Prev(glmNetwork, highlightedNodes, counter)}
            next={() => Next(glmNetwork, highlightedNodes, counter)}
         />
      </div>
   );
};

export default Graph;
