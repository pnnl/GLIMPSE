import React, { useEffect } from "react";
import { useLocation } from "react-router";
import { useLoadGraph } from "@react-sigma/core";
import graphHelper from "../graphHelper/GraphHelper";
import { useSigma } from "@react-sigma/core";

// Accept an optional onGraphLoaded callback (receives graph.order)
const Graph = ({ onGraphLoaded }) => {
   const location = useLocation();
   const loadGraph = useLoadGraph();
   const sigma = useSigma();

   useEffect(() => {
      graphHelper.setGraphData(location.state.fileData);
      // load into sigma
      loadGraph(graphHelper.graph);
      graphHelper.sigmaInstance = sigma;

      // If loadGraph returns a promise-like, try to wait, otherwise update immediately
      onGraphLoaded && onGraphLoaded(graphHelper.graph.order);

      return () => {
         graphHelper.graph.clear();
         onGraphLoaded && onGraphLoaded(0);
         graphHelper.reset();
         graphHelper.sigmaInstance = null;
      };
   }, [loadGraph, location, onGraphLoaded, sigma]);

   return null;
};

export default Graph;
