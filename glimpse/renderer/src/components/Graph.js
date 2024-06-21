import React, { useEffect, useRef } from "react";
import { Box, Stack, IconButton } from "@mui/material";
import { RotateLeftRounded, RotateRightRounded } from "@mui/icons-material";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
// import ActionBar from "./ActionBar";
import ActionDrawer from "./ActionDrawer";
import NodePopup from "./NodePopup";
import "../styles/vis-network.css";
import "../styles/Graph.css";
import Legend from "./Legend";
import ContextMenu from "./ContextMenu";
import NewNodeForm from "./NewNodeForm";
import VisActionsDial from "./VisActionsDial";
const { graphOptions } = JSON.parse(await window.glimpseAPI.getConfig());
// import * as d3 from "d3";
import {
   getTitle,
   setGraphData,
   Export,
   getLegendData,
   NodeFocus,
   hideEdge,
   hideEdges,
   updateNode,
   showAttributes,
   hideObjects,
   HighlightEdges,
   HighlightGroup,
   Next,
   Prev,
   rotateCW,
   rotateCCW,
   // renameKeys,
} from "../utils/graphUtils";

const ANGLE = Math.PI / 12; // 15 degrees in radians

const Graph = ({ dataToVis, theme, isGlm }) => {
   const container = useRef(null);
   const toggleLegendRef = useRef(null);
   const showLegendStateRef = useRef(null);

   const GLIMPSE_OBJECT = { objects: [] };
   const nodeTypes = Object.keys(theme.groups);
   const edgeTypes = Object.keys(theme.edgeOptions);

   const edgeOptions = theme.edgeOptions;
   let glmNetwork = null; // global network varibale
   const counter = { value: -1 }; // counter to navigate through highlighted nodes
   const highlightedNodes = useRef([]);
   const highlightedEdges = useRef([]);

   // const svgRef = useRef(null);

   const addedOverlayObjects = {
      nodes: [],
      edges: [],
   };

   // data object that holds a DataSet for nodes and edges
   const graphData = {
      nodes: new DataSet(),
      edges: new DataSet(),
   };

   // used to keep count of each object type
   const objectTypeCount = {
      nodes: Object.keys(theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
      edges: Object.keys(theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
   };

   objectTypeCount.edges.parentChild = 0;

   let setLegendData;
   const legendMount = (legendSetFunc) => {
      setLegendData = legendSetFunc;
   };

   //Reverts all nodes and edges back to their original styles
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
    * Turns phyics on or off
    * @param {bool} toggle - True turns on physics, false turns off physics
    */
   const TogglePhysics = (toggle) => {
      if (toggle) glmNetwork.setOptions({ physics: { enabled: true } });
      else glmNetwork.setOptions({ physics: { enabled: false } });
   };

   /* ------------------------ Establish Network ------------------------ */

   setGraphData(
      graphData,
      dataToVis,
      nodeTypes,
      edgeTypes,
      objectTypeCount,
      GLIMPSE_OBJECT,
      theme,
      edgeOptions
   );

   console.log("Number of Nodes: " + graphData.nodes.length);
   console.log("Number of Edges: " + graphData.edges.length);

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

   const openNewNodeForm = (openFormBool) => {
      newNodeFormSetState(openFormBool);
   };

   /** close the node pupup component */
   const closePopUp = () => {
      setOpenNodePopup(false);
   };

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
    * @param {Object} fileData - Should Contain the file's name with extension and the file's data
    * @param {string} filename - Name of the file
    * @param {Object} data - the json data of the uploaded file
    */
   const attachOverlay = ({ filename, fileData }) => {
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
            })[0]
         );

         objectTypeCount.nodes.microgrid++;

         for (const type of Object.keys(microgrid)) {
            if (types.includes(type)) {
               microgrid[type].forEach((nodeID) => {
                  addedOverlayObjects.edges.push(
                     graphData.edges.add({
                        id: `parentChild:${microgrid.name}-${nodeID}`,
                        from: microgrid.name,
                        to: nodeID,
                        color: { inherit: true },
                        type: type,
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
               })[0]
            );

            objectTypeCount.nodes.communication_node++;

            for (const type of Object.keys(comm_node)) {
               if (types.includes(type)) {
                  comm_node[type].forEach((nodeID) => {
                     addedOverlayObjects.edges.push(
                        graphData.edges.add({
                           id: `parentChild:${comm_node.name}-${nodeID}`,
                           from: comm_node.name,
                           to: nodeID,
                           type: type,
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

      setLegendData(getLegendData(objectTypeCount, theme, edgeOptions));
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
         const nodesOfsameType = graphData.nodes.get().filter((n) => n.group === node_types[nodeType]);

         const [addedNodeID] = graphData.nodes.add({
            id: `${nodeID}`,
            label: `${nodeID}`,
            group: node_types[nodeType],
            level:
               "level" in nodesOfsameType[0].attributes
                  ? nodesOfsameType[0].attributes.level
                  : undefined,
         });

         const title = getTitle(graphData.nodes.get(addedNodeID));
         const addedNode = graphData.nodes.get(addedNodeID);
         addedNode.title = title;
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

         setLegendData(getLegendData(objectTypeCount, theme, edgeOptions));
      } catch (err) {
         alert(`${node_types[nodeType]}_${nodeID} already exists...`);
      }
   };

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

      setLegendData(getLegendData(objectTypeCount, theme, edgeOptions));
   };

   const toggleVisOptions = () => {
      const layoutForm = document.getElementById("layout-form");
      const graph = document.getElementById("graph");

      if (layoutForm.style.display === "none" || layoutForm.style.display === "") {
         graph.style.width = "72%";
         layoutForm.style.display = "flex";
         toggleLegendRef.current(false);
      } else {
         if (graph.style.width === "30%") {
            graph.style.width = "72%";
         }
         layoutForm.style.display = "none";
         toggleLegendRef.current(true);
      }
   };

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

      setLegendData(getLegendData(objectTypeCount, theme, edgeOptions));
   };

   useEffect(() => {
      const removeListenerArr = [];
      removeListenerArr.push(window.glimpseAPI.onShowVisOptions(toggleVisOptions));
      removeListenerArr.push(window.glimpseAPI.onExtract(() => Export(graphData, isGlm, dataToVis)));
      removeListenerArr.push(
         window.glimpseAPI.onShowAttributes((show) => showAttributes(show, graphData))
      );
      removeListenerArr.push(
         window.glimpseAPI.onExportTheme(() =>
            window.glimpseAPI.exportTheme(JSON.stringify(theme, null, 3))
         )
      );
      removeListenerArr.push(
         window.glimpseAPI.onUpdateData((updateData) => updateNode(updateData, graphData))
      );

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

   useEffect(() => {
      if ("x" in graphData.nodes.get()[0] && "y" in graphData.nodes.get()[0]) {
         graphOptions.physics.stabilization.enabled = false;
         graphOptions.physics.enabled = false;
         graphOptions.groups = theme.groups;
         document.getElementById("circularProgress").style.display = "none";
         glmNetwork = new Network(container.current, graphData, graphOptions);
      } else {
         if (
            graphData.nodes.length > 151 &&
            graphData.nodes.length <= 300 &&
            graphData.edges.length >= 7000
         ) {
            graphOptions.physics.solver = "forceAtlas2Based";
            // graphOptions.nodes.scaling.max = 100;
            // graphOptions.nodes.scaling.label.max = 90;
         } else if (graphData.nodes.length > 300 && graphData.edges.length < 7000) {
            graphOptions.physics.timestep = 0.72;
            graphOptions.physics.barnesHut.gravitationalConstant = -100000;
            graphOptions.physics.barnesHut.springConstant = 0.85;
            graphOptions.physics.barnesHut.centralGravity = 0.1;
            graphOptions.physics.barnesHut.springLength = 95;
            graphOptions.physics.barnesHut.avoidOverlap = 0.6;
            graphOptions.physics.barnesHut.damping = 0.1;
            // graphOptions.nodes.scaling.max = 100;
            // graphOptions.nodes.scaling.label.max = 90;
         }

         // create network
         graphOptions.groups = theme.groups;
         glmNetwork = new Network(container.current, graphData, graphOptions);

         glmNetwork.on("stabilizationProgress", (params) => {
            /* Math for determining the radius of the circular progress bar based on the stabilization progress */
            const maxWidth = 360;
            const minWidth = 1;
            const widthFactor = params.iterations / params.total;
            const width = Math.max(minWidth, maxWidth * widthFactor);
            document.getElementById(
               "circularProgress"
            ).style.background = `conic-gradient(#b25a00 ${width}deg, #333 0deg)`;
            document.getElementById("progressValue").innerText = Math.round(widthFactor * 100) + "%";
         });

         glmNetwork.once("stabilizationIterationsDone", () => {
            /* Once stabilization is done the circular progress with display 100% for half a second then hide */
            document.getElementById("circularProgress").style.background =
               "conic-gradient(#b25a00 360deg, #333 0deg)";
            document.getElementById("progressValue").innerText = "100%";
            document.getElementById("circularProgress").style.opacity = 0.7;

            /* set physics to false for better performance when stabalization is done */
            glmNetwork.setOptions({ physics: { enabled: false } });

            setTimeout(() => {
               document.getElementById("circularProgress").style.display = "none";
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
         if (
            glmNetwork.getEdgeAt(params.pointer.DOM) !== undefined &&
            glmNetwork.getNodeAt(params.pointer.DOM) === undefined
         ) {
            setContextMenuData({ edgeID: glmNetwork.getEdgeAt(params.pointer.DOM) });
         } else if (glmNetwork.getNodeAt(params.pointer.DOM) !== undefined) {
            setContextMenuData({ nodeID: glmNetwork.getNodeAt(params.pointer.DOM) });
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
   }, []);

   // a d3.js example
   // useEffect(() => {
   //    const width = 1200;
   //    const height = 900;

   //    // const color = d3.scaleOrdinal(d3.schemeCategory10);

   //    const links = graphData.edges
   //       .get()
   //       .map((edge) => renameKeys({ from: "source", to: "target" }, edge));
   //    const nodes = graphData.nodes.get();

   //    const simulation = d3
   //       .forceSimulation(nodes)
   //       .force(
   //          "link",
   //          d3.forceLink(links).id((node) => node.id)
   //       )
   //       .force("charge", d3.forceManyBody())
   //       .force("center", d3.forceCenter(width / 2, height / 2))
   //       .on("tick", ticked);

   //    const svg = d3
   //       .select(svgRef.current)
   //       .attr("width", width)
   //       .attr("height", height)
   //       .attr("viewBox", [0, 0, width, height])
   //       .attr("style", "max-width: 100%; height: auto;");

   //    const link = svg
   //       .append("g")
   //       .attr("stroke", "#999")
   //       .attr("stroke-apacity", 0.6)
   //       .selectAll()
   //       .data(links)
   //       .join("line")
   //       .attr("stroke-width", 2);

   //    const node = svg
   //       .append("g")
   //       .attr("stroke", "#fff")
   //       .attr("stroke-width", 1.5)
   //       .selectAll()
   //       .data(nodes)
   //       .join("circle")
   //       .attr("r", 5)
   //       .attr("fill", "blue");

   //    node.append("tittle").text((node) => node.id);
   //    link.append("p").text((edge) => edge.id);

   //    const zoom = d3
   //       .zoom()
   //       .scaleExtent([0.1, 10])
   //       .on("zoom", (e) => {
   //          node.attr("transform", e.transform);
   //          link.attr("transform", e.transform);
   //       });

   //    svg.call(zoom);

   //    node.call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

   //    // Set the position attributes of links and nodes each time the simulation ticks.
   //    function ticked() {
   //       link
   //          .attr("x1", (d) => d.source.x)
   //          .attr("y1", (d) => d.source.y)
   //          .attr("x2", (d) => d.target.x)
   //          .attr("y2", (d) => d.target.y);

   //       node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
   //    }

   //    // Reheat the simulation when drag starts, and fix the subject position.
   //    function dragstarted(event) {
   //       if (!event.active) simulation.alphaTarget(0.3).restart();
   //       event.subject.fx = event.subject.x;
   //       event.subject.fy = event.subject.y;
   //    }

   //    // Update the subject (dragged node) position during drag.
   //    function dragged(event) {
   //       event.subject.fx = event.x;
   //       event.subject.fy = event.y;
   //    }

   //    // Restore the target alpha so the simulation cools after dragging ends.
   //    // Unfix the subject position now that it’s no longer being dragged.
   //    function dragended(event) {
   //       if (!event.active) simulation.alphaTarget(0);
   //       event.subject.fx = null;
   //       event.subject.fy = null;
   //    }

   //    // When this cell is re-run, stop the previous simulation. (This doesn’t
   //    // really matter since the target alpha is zero and the simulation will
   //    // stop naturally, but it’s a good practice.)
   //    // invalidation.then(() => simulation.stop());
   // });

   return (
      <>
         {/* <ActionBar
            graphDataObj={GLIMPSE_OBJECT}
            nodesDataObj={graphData.nodes}
            physicsToggle={TogglePhysics}
            reset={Reset}
            onFind={(id) => NodeFocus(id, glmNetwork)}
            prev={() => Prev(glmNetwork, highlightedNodes, counter)}
            next={() => Next(glmNetwork, highlightedNodes, counter)}
            addGraphOverlay={setCommunicationNetwork}
            getNodeIds={() => graphData.nodes.getIds()}
            toggleLegendRef={toggleLegendRef}
            showLegendStateRef={showLegendStateRef}
            removeOverlay={removeOverlay}
         /> */}

         <NodePopup onMount={onChildMount} onSave={saveEdits} close={closePopUp} />

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
            deleteNode={deleteNode}
         />

         <ActionDrawer
            findNode={(id) => NodeFocus(id, glmNetwork)}
            getNodeIds={() => graphData.nodes.getIds()}
            physicsToggle={TogglePhysics}
            toggleLegendRef={toggleLegendRef}
            showLegendStateRef={showLegendStateRef}
            attachOverlay={attachOverlay}
            removeOverlay={removeOverlay}
            reset={Reset}
         />

         <Box component={"div"} sx={{ width: "100%", height: "calc(100vh - 4rem)" }}>
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
                     HighlightEdges(edgeType, highlightedNodes, graphData, edgeOptions, highlightedEdges)
                  }
                  hideObjects={(objType, type) => hideObjects(objType, type, graphData)}
                  legendData={getLegendData(objectTypeCount, theme, edgeOptions)}
                  onMount={legendMount}
                  setShowLegendRef={toggleLegendRef}
                  legendStateRef={showLegendStateRef}
               />
            </Stack>

            <VisActionsDial
               rotateCW={() => rotateCW(graphData, glmNetwork, ANGLE)}
               rotateCCW={() => rotateCCW(graphData, glmNetwork, ANGLE)}
               prev={() => Prev(glmNetwork, highlightedNodes, counter)}
               next={() => Next(glmNetwork, highlightedNodes, counter)}
            />
         </Box>
      </>
   );
};

export default Graph;
