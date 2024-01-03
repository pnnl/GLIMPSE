import React, { useEffect, useRef } from "react";
import { Network } from "vis-network";
import { DataSet } from "vis-data";
import "../styles/vis-network.css";
import "../styles/Legend.css";
import appConfig from "./config/appConfig.json";
import LegendContextMenu from "./LegendContextMenu";

const Legend = ({ findGroup, findEdges, nodeCounts, hideObjects }) => {
  const nodes = [];
  const edges = [];

  // Map of the options belonging to each edge type
   const edgeOptions ={
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
         color: { inherit: true },
         hidden: false,
      },
      "communication": {
         width: 8,
         color: { inherit: false },
         hidden: false,
      },
      "microgrid_connection": {
         width: 8,
         color: "cyan",
         hidden: false,
      }
   }

   const addEdgeLegend = (type, count) => {

   }

  /*-------- Begining of Top Nodes --------*/
  nodes.push({
    id: "load",
    x: 37,
    y: -22,
    fixed: true,
    physics: false,
    label: `load\n[${nodeCounts.nodes.load}]`,
    group: "load"
  });

  nodes.push({
    id: "node",
    x: 166,
    y: -22,
    fixed: true,
    physics: false,
    label: `node\n[${nodeCounts.nodes.node}]`,
    group: "node"
  });

  nodes.push({
    id: "meter",
    x: 297,
    y: -22,
    fixed: true,
    physics: false,
    label: `meter\n[${nodeCounts.nodes.meter}]`,
    group: "meter"
  });

  nodes.push({
    id: "inverter_dyn",
    x: 424,
    y: -22,
    fixed: true,
    physics: false,
    label: `inverter_dyn\n[${nodeCounts.nodes.inverter_dyn}]`,
    group: "inverter_dyn",
  });

  nodes.push({
    id: "diesel_dg",
    x: 562,
    y: -22,
    fixed: true,
    physics: false,
    label: `diesel_dg\n[${nodeCounts.nodes.diesel_dg}]`,
    group: "diesel_dg",
  });

  nodes.push({
    id: 6,
    x: 700,
    y: -22,
    fixed: true,
    physics: false,
    label: `capacitor\n[${nodeCounts.nodes.capacitor}]`,
    group: "capacitor",
  });
  /*-------- End of Top Nodes --------*/

  /*-------- Begining of Bottom Nodes --------*/
  nodes.push({
    id: "triplex_load",
    x: 37,
    y: 100,
    fixed: true,
    physics: false,
    label: `triplex_load\n[${nodeCounts.nodes.triplex_load}]`,
    group: "triplex_load",
  });

  nodes.push({
    id: "triplex_node",
    x: 166,
    y: 100,
    fixed: true,
    physics: false,
    label: `triplex_node\n[${nodeCounts.nodes.triplex_node}]`,
    group: "triplex_node",
  });

  nodes.push({
    id: "triplex_meter",
    x: 297,
    y: 100,
    fixed: true,
    physics: false,
    label: `triplex_meter\n[${nodeCounts.nodes.triplex_meter}]`,
    group: "triplex_meter",
  });

  nodes.push({
    id: "substation",
    x: 424,
    y: 100,
    fixed: true,
    physics: false,
    label: `substation\n[${nodeCounts.nodes.substation}]`,
    group: "substation",
  });

  nodes.push({
    id: "communication_node",
    x: 562,
    y: 100,
    fixed: true,
    physics: false,
    label: "communication\nnode",
    group: "communication_node",
  });

  nodes.push({
    id: "microgrid",
    x: 700,
    y: 100,
    fixed: true,
    physics: false,
    label: "End\nPoints",
    group: "microgrid",
  });
  /*-------- End of Bottom Nodes --------*/

  /*-------- Begining of Empty Nodes --------*/
  nodes.push({
    id: 100,
    x: 37,
    y: 250,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 101,
    x: 700,
    y: 250,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 102,
    x: 37,
    y: 325,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 103,
    x: 700,
    y: 325,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 104,
    x: 37,
    y: 400,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 105,
    x: 700,
    y: 400,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 106,
    x: 37,
    y: 475,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 107,
    x: 700,
    y: 475,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 108,
    x: 37,
    y: 550,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 109,
    x: 700,
    y: 550,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 110,
    x: 37,
    y: 625,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 111,
    x: 700,
    y: 625,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 112,
    x: 37,
    y: 700,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 113,
    x: 700,
    y: 700,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 114,
    x: 37,
    y: 775,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 115,
    x: 700,
    y: 775,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 116,
    x: 37,
    y: 850,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 117,
    x: 700,
    y: 850,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 118,
    x: 37,
    y: 925,
    fixed: true,
    physics: false,
    color: "black",
  });

  nodes.push({
    id: 119,
    x: 700,
    y: 925,
    fixed: true,
    physics: false,
    color: "black",
  });
  /*-------- End of Empty Nodes --------*/

  /*-------- Begining of Edges --------*/
  edges.push({
    from: 100,
    to: 101,
    id: "overhead_line",
    label: `overhead_line [${nodeCounts.edges.overhead_line}]`,
    width: edgeOptions.overhead_line.width,
    color: edgeOptions.overhead_line.color,
  });

  edges.push({
    from: 102,
    to: 103,
    id: "switch",
    label: `switch [${nodeCounts.edges.switch}]`,
    width: edgeOptions.switch.width,
    color: edgeOptions.switch.color,
  });

  edges.push({
    from: 104,
    to: 105,
    id: "underground_line",
    label: `underground_line [${nodeCounts.edges.underground_line}]`,
    width: edgeOptions.underground_line.width,
    color: edgeOptions.underground_line.color,
  });

  edges.push({
    from: 106,
    to: 107,
    id: "regulator",
    label: `regulator [${nodeCounts.edges.regulator}]`,
    width: edgeOptions.regulator.width,
    color: edgeOptions.regulator.color,
  });

  edges.push({
    from: 108,
    to: 109,
    id: "transformer",
    label: `transformer [${nodeCounts.edges.transformer}]`,
    width: edgeOptions.transformer.width,
    color: edgeOptions.transformer.color,
  });

  edges.push({
    from: 110,
    to: 111,
    id: "triplex_line",
    label: `triplex_line [${nodeCounts.edges.triplex_line}]`,
    width: edgeOptions.triplex_line.width,
    color: edgeOptions.triplex_line.color,
  });

  edges.push({
    from: 112,
    to: 113,
    id: "series_reactor",
    label: `series_reactor [${nodeCounts.edges.series_reactor}]`,
    width: edgeOptions.series_reactor.width,
    color: edgeOptions.series_reactor.color,
  });

  edges.push({
    from: 114,
    to: 115,
    id: "communication",
    label: `communication`,
    width: edgeOptions.communication.width,
    color: edgeOptions.communication.color,
  });

  edges.push({
    from: 116,
    to: 117,
    id: "microgrid_connection",
    label: `microgrid_connection`,
    width: edgeOptions.microgrid_connection.width,
    color: edgeOptions.microgrid_connection.color,
  });

  edges.push({
    from: 118,
    to: 119,
    id: "mapping",
    label: `mapping`,
    width: edgeOptions.mapping.width,
    color: edgeOptions.mapping.color,
  });
  /*-------- End of Edges --------*/

  const nodesDataSet = new DataSet(nodes);
  const edgesDataSet = new DataSet(edges);

  const options = appConfig.legendGraphOptions;

   const data = {
      nodes: nodesDataSet,
      edges: edgesDataSet,
   };

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
