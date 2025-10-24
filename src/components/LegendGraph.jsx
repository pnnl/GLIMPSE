import React, { useEffect } from "react";
import { useLoadGraph } from "@react-sigma/core";
import graphHelper from "../graphHelper/GraphHelper";

const LegendGraph = () => {
   const loadLegendGraph = useLoadGraph();
   useEffect(() => {
      if (graphHelper.legendGraph.nodes()) {
         loadLegendGraph(graphHelper.legendGraph);
      }
      return () => graphHelper.legendGraph.clear();
   }, [loadLegendGraph]);

   return null;
};

export default LegendGraph;
