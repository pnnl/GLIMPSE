import React, { useEffect, useRef, useState} from "react";
import { Network } from "vis-network";
// import { DataSet } from "vis-data";
import "./styles/vis-network.css";
import "./styles/Legend.css";
import appConfig from "./config/appConfig.json";
import LegendContextMenu from "./LegendContextMenu";

const Legend = ({ findGroup, findEdges, hideObjects, onMount, legendData}) => {
   const [data, setData] = useState(legendData);

   useEffect(() => {
      onMount(setData);  
   });

   const options = appConfig.legendGraphOptions;
   const container = useRef(null);

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
   }, [data]);

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
};

export default Legend;