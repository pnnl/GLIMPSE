import React, { useEffect, useRef, useState } from "react";
import { Network } from "vis-network";
import { Box } from "@mui/material";
import LegendContextMenu from "./LegendContextMenu";
import "./styles/vis-network.css";
const { legendGraphOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const Legend = ({
   highlightNodes,
   highlightEdges,
   hideObjects,
   onMount,
   legendData,
   setShowLegendRef,
   legendStateRef,
}) => {
   const container = useRef(null);
   const [data, setData] = useState(legendData);
   const [showLegend, setShowLegend] = useState(true);

   // set the current state as refs from the Graph component
   useEffect(() => {
      setShowLegendRef.current = setShowLegend;
      legendStateRef.current = showLegend;
   });

   useEffect(() => {
      onMount(setData);
   });

   // Getting the state and set state variables from the legend context menu component
   let contextMenuData;
   let setContextMenuData;
   const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   };

   const handleContext = (e) => {
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

   useEffect(() => {
      if (showLegend) {
         const network = new Network(container.current, data, legendGraphOptions);
         network.fit();

         network.on("doubleClick", function (params) {
            if (params.nodes[0]) {
               let g = data.nodes.get(params.nodes[0]);
               highlightNodes(g.group);
            }
            if (params.edges[0]) {
               let e = data.edges.get(params.edges[0]);
               highlightEdges(e.id);
            }

            network.fit();
         });

         // set the context menu data with either a node or edge ID so that type can be hidden in the main network
         network.on("oncontext", (params) => {
            if (network.getNodeAt(params.pointer.DOM)) {
               const ID = network.getNodeAt(params.pointer.DOM);
               setContextMenuData({ object: data.nodes.get(ID).group, type: "node" });
            } else if (network.getEdgeAt(params.pointer.DOM)) {
               const ID = network.getEdgeAt(params.pointer.DOM);
               setContextMenuData({ object: data.edges.get(ID).id, type: "edge" });
            }
         });

         const networkCanvas = document
            .getElementById("legend-network")
            .getElementsByTagName("canvas")[0];

         const changeCursor = (newCursorStyle) => {
            networkCanvas.style.cursor = newCursorStyle;
         };

         network.on("hoverNode", () => changeCursor("pointer"));
         network.on("blurNode", () => changeCursor("default"));
         network.on("hoverEdge", () => changeCursor("pointer"));
         network.on("blurEdge", () => changeCursor("default"));
      }
   });

   if (!showLegend) return null;

   return (
      <>
         <Box
            id="legend-network"
            component={"div"}
            sx={{ height: "100%", width: "30%", borderLeft: "1px solid lightgrey" }}
            ref={container}
            onContextMenu={handleContext}
         />

         <LegendContextMenu onMount={onContextMenuChildMount} hideObjects={hideObjects} />
      </>
   );
};

export default Legend;
