import { useEffect } from "react";
import { bindWebGLLayer, createContoursProgram } from "@sigma/layer-webgl";
import { useLoadGraph, useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";
import { useGraph } from "../contexts/GraphContext";

const Graph = () => {
   const loadGraph = useLoadGraph();
   const sigma = useSigma();
   const { graphUpdateTrigger } = useGraph();

   useEffect(() => {
      // loadGraph copies graphHelper.graph (standalone) into sigma's internal graph
      loadGraph(graphHelper.graph);
      console.log("graph loaded with order:", graphHelper.graph.order);

      // Store sigma reference
      graphHelper.sigmaInstance = sigma;

      graphHelper.graph = sigma.getGraph();
   }, [sigma, loadGraph, graphUpdateTrigger]);

   useEffect(() => {
      if (!sigma) return;
      const cleanupFunctions = [];

      if (graphHelper.communitiesArray.length === 0) return;

      sigma.setMaxListeners(graphHelper.communitiesArray.length + 10);

      graphHelper.communitiesArray.forEach((community) => {
         try {
            const nodesInCommunity = graphHelper.graph.filterNodes(
               (_nodeID, attrs) => attrs.community === community,
            );
            cleanupFunctions.push(
               bindWebGLLayer(
                  `community-${community}`,
                  sigma,
                  createContoursProgram(nodesInCommunity, {
                     radius: 50,
                     border: {
                        color: graphHelper.communityColorPallet[community],
                        thickness: 8,
                     },
                     levels: [{ color: "#00000000", threshold: 0.5 }],
                  }),
               ),
            );
         } catch (error) {
            console.error(`[WebGL] Failed to create layer for community ${community}:`, error);
         }
      });

      return () => {
         cleanupFunctions.forEach((cleanup) => cleanup());
      };
   }, [sigma, graphUpdateTrigger]);

   return null;
};

export default Graph;
