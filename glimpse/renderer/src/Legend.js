import React, { useEffect, useRef, useState} from "react";
import { Network } from "vis-network";
import "./styles/vis-network.css";
import "./styles/Legend.css";
import appConfig from "./config/appConfig.json";
import LegendContextMenu from "./LegendContextMenu";
const options = appConfig.legendGraphOptions;
// const groups = appConfig.graphOptions.groups;

const Legend = ({
   findGroup,
   findEdges,
   hideObjects,
   onMount,
   legendData,
   setShowLegendRef,
   legendStateRef
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
   const onContextMenuChildMount = (contextMenuDataState,setContextMenuDataState) => {
      contextMenuData = contextMenuDataState;
      setContextMenuData = setContextMenuDataState;
   };
   
   const handleContext = (e) => {
      e.preventDefault();
      
      if (contextMenuData !== null) {
         setContextMenuData({
            ...contextMenuData,
            mouseX: e.pageX + 2,
            mouseY: e.pageY + 6,
         });
      }
      else {
         setContextMenuData(null);
      }
   };

   useEffect(() => {
      if (showLegend) {
         const network = new Network(container.current, data, options);
         network.fit();
         
         network.on("doubleClick", function (params) {
            if (params.nodes[0]) {
               let g = data.nodes.get(params.nodes[0]);
               findGroup(g.group);
            }
            if (params.edges[0]) {
               let e = data.edges.get(params.edges[0]);
               findEdges(e.id);
            }
         });
         
         // set the context menu data with either a node or edge ID so that type can be hidden in the main network
         network.on("oncontext", (params) => {
            if (network.getNodeAt(params.pointer.DOM)) {
               const ID = network.getNodeAt(params.pointer.DOM);
               setContextMenuData({ object: data.nodes.get(ID).group, type: "node" });
            } 
            else if (network.getEdgeAt(params.pointer.DOM)) {
               const ID = network.getEdgeAt(params.pointer.DOM);
               setContextMenuData({ object: data.edges.get(ID).id, type: "edge" });
            }
         });
      }
   });

   if (!showLegend) return null;

   return (
      <>
         <div
            className="visLegend"
            ref={container}
            onContextMenu={handleContext}
         />

         <LegendContextMenu
            onMount={onContextMenuChildMount}
            hideObjects={hideObjects}
         />
      </>
   );
}

export default Legend;