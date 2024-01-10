import React, { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import "./styles/vis-network.css";
import "./styles/Legend.css";
import appConfig from "./config/appConfig.json";
import LegendContextMenu from "./LegendContextMenu";

const Legend = ({ findGroup, findEdges, typeCounts, hideObjects }) => {
   const edgeOptions = {
      "overhead_line": {
         width: 8,
         color: "#000000",
         hidden: false,
      },
      "switch": {
         width: 8,
         color: "#3a0ca3",
         hidden: false,
      },
      "series_reactor": {
         width: 8,
         color: "#3c1642",
         hidden: false,
      },
      "triplex_line": {
         width: 8,
         color: "#c86bfa",
         hidden: false,
      },
      "underground_line": {
         width: 8,
         color: "#FFFF00",
         hidden: false,
      },
      "regulator": {
         width: 8,
         color: "#ff447d",
         hidden: false,
      },
      "transformer": {
         width: 8,
         color: "#00FF00",
         hidden: false,
      },
      "mapping": {
         width: 8,
         color: "#283618",
         hidden: false,
      },
      "communication": {
         width: 8,
         color: "grey",
         hidden: false,
      },
      "microgrid_connection": {
         width: 8,
         color: "cyan",
         hidden: false,
      },
      "parentChild": {
         width: 8,
         color: "#15616d",
         hidden: false
      },
      "line": {
         width: 8,
         color: "black",
         hidden: false
      }
   }

   const options = appConfig.legendGraphOptions;
   const currentNodeTypes = [];
   const currentEdgeTypes = [];
   const data = {
      nodes: new DataSet(),
      edges: new DataSet()   
   }

   /*
      x: 0 - 663, y: 100 for first row of nodes
      x: 0 - 663, y: 0 for second row if needed
   */
   Object.entries(typeCounts.nodes).forEach(([type, count], i) => {
      if (count > 0) currentNodeTypes.push(type);
   });

   Object.entries(typeCounts.edges).forEach(([type, count], i) => {
      if (count > 0) currentEdgeTypes.push(type);
   });
   
   const x_increment = 1250 / currentNodeTypes.length;
   let farthest_x = 0;
   let current_x = 0;
   let current_y = 0;
   let rowNodeCount = 0;

   for (let nodeType of currentNodeTypes) {
      
      if (data.nodes.length === 0) {
         data.nodes.add({
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

      data.nodes.add({
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

      data.nodes.add({
         id: `${type}:${index}`,
         x: 0,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "black"
      });

      data.nodes.add({
         id: `${type}:${index + 1}`,
         x: farthest_x === 0 ? current_x : farthest_x,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "black"
      })

      data.edges.add({
         id: type,
         from: `${type}:${index}`,
         to: `${type}:${index + 1}`,
         label: `${type} [${typeCounts.edges[type]}]`,
         width: edgeOptions[type].width,
         color: edgeOptions[type].color
      });

      current_y += 65;
   });

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
   });

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
