import { useEffect } from "react";
import { bindWebGLLayer, createContoursProgram } from "@sigma/layer-webgl";
// import { useLocation } from "react-router";
import { useLoadGraph } from "@react-sigma/core";
import { useSigma } from "@react-sigma/core";
import graphHelper from "../graph-helper/GraphHelper";
import { useGraph } from "../contexts/GraphContext";

const Graph = () => {
   // const location = useLocation();
   const loadGraph = useLoadGraph();
   const sigma = useSigma();
   const { graphUpdateTrigger } = useGraph();

   // Separate effects for different purposes
   // Effect 1: Load graph data (runs when location changes)
   useEffect(() => {
      if (graphHelper.graph.order === 0) return;

      try {
         loadGraph(graphHelper.graph);
         console.log("graph loaded with order:", graphHelper.graph.order);
         // Store reference to sigma instance for interaction
         graphHelper.sigmaInstance = sigma;

         // Notify the app that a graph was loaded so the header can show search
         console.log(`Dispatching 'graph-loaded' event with order:`, graphHelper.graph.order);
         window.dispatchEvent(
            new CustomEvent("graph-loaded", { detail: { order: graphHelper.graph.order } }),
         );
      } catch (error) {
         console.error("Error loading graph:", error);
      }

      return () => {
         // Don't clear the graph here as it will be cleared by clearGraphData()
         graphHelper.sigmaInstance = null;
      };
   }, [sigma, loadGraph, graphUpdateTrigger]);

   // Effect 2: Setup WebGL layers (runs after graph is ready, only once)
   useEffect(() => {
      if (!sigma) return;
      const cleanupFunctions = [];

      console.log(`[WebGL] Graph loaded. Communities:`, graphHelper.communitiesArray.length);
      console.log(`[WebGL] Communities array:`, graphHelper.communitiesArray);
      console.log(`[WebGL] Color pallet:`, graphHelper.communityColorPallet);

      if (graphHelper.communitiesArray.length === 0) {
         console.log(`[WebGL] No communities to render`);
         return;
      }

      // Increase max listeners to avoid warning
      sigma.setMaxListeners(graphHelper.communitiesArray.length + 10);

      graphHelper.communitiesArray.forEach((community) => {
         try {
            const nodesInCommunity = graphHelper.graph.filterNodes((nodeID, attrs) => {
               return attrs.community === community;
            });

            // bindWebGLLayer returns a cleanup function
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
                     levels: [
                        {
                           color: "#00000000",
                           threshold: 0.5,
                        },
                     ],
                  }),
               ),
            );

            // Register the cleanup function with context for later cleanup
            console.log(`[WebGL] Successfully created contour layer for community ${community}`);
         } catch (error) {
            console.error(`[WebGL] Failed to create layer for community ${community}:`, error);
         }
      });

      return () => {
         console.log(`[WebGL] Cleaning up all layers`);
         cleanupFunctions.forEach((cleanup) => cleanup());
      };
   }, [sigma, graphUpdateTrigger]);

   return null;
};

export default Graph;
