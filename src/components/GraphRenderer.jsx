import "@react-sigma/core/lib/style.css";
import { useMemo, useEffect } from "react";
import {
   SigmaContainer,
   ControlsContainer,
   ZoomControl,
   FullScreenControl,
} from "@react-sigma/core";
import { LayoutForceAtlas2Control } from "@react-sigma/layout-forceatlas2";
import { MultiUndirectedGraph } from "graphology";
import { EdgeRectangleProgram } from "sigma/rendering";
import { createNodeImageProgram } from "@sigma/node-image";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { createNodeCompoundProgram } from "sigma/rendering";
import graphHelper from "../graphHelper/GraphHelper";
import GraphEvents from "./GraphEvents";
import EdgeCurveProgram from "@sigma/edge-curve";
import { drawLabel, drawHover } from "../utils/canvas-utils";
import { bindWebGLLayer, createContoursProgram } from "@sigma/layer-webgl";
import { useLocation } from "react-router";
import { useLoadGraph } from "@react-sigma/core";
import { useSigma } from "@react-sigma/core";
import { useSigmaContext } from "../contexts/useSigmaContext";

const Graph = () => {
   const location = useLocation();
   const loadGraph = useLoadGraph();
   const sigma = useSigma();
   const { setSigma, registerWebGLLayer, cleanupAllWebGLLayers } = useSigmaContext();

   // Separate effects for different purposes
   // Effect 1: Load graph data (runs when location changes)
   useEffect(() => {
      if (!location.state?.fileData) return;

      graphHelper.setGraphData(location.state.fileData);
      loadGraph(graphHelper.graph);
      graphHelper.sigmaInstance = sigma;

      // Expose sigma to context for access from anywhere in the app
      setSigma(sigma);

      // Notify the app that a graph was loaded so the header can show search
      try {
         window.dispatchEvent(
            new CustomEvent("graph-loaded", { detail: { order: graphHelper.graph.order } })
         );
      } catch {
         // ignore if CustomEvent not supported (very old browsers)
         void 0;
      }

      return () => {
         graphHelper.graph.clear();
         graphHelper.reset();
         graphHelper.sigmaInstance = null;
         setSigma(null);
      };
   }, [location, sigma, loadGraph, setSigma]);

   // Effect 2: Setup WebGL layers (runs after graph is ready, only once)
   useEffect(() => {
      if (!sigma) return;

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
            const cleanup = bindWebGLLayer(
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
               })
            );

            // Register the cleanup function with context for later cleanup
            registerWebGLLayer(`community-${community}`, cleanup);
            console.log(`[WebGL] Successfully created contour layer for community ${community}`);
         } catch (error) {
            console.error(`[WebGL] Failed to create layer for community ${community}:`, error);
         }
      });

      return () => {
         console.log(`[WebGL] Cleaning up all layers`);
         cleanupAllWebGLLayers();
      };
   }, [sigma, registerWebGLLayer, cleanupAllWebGLLayers]);

   return null;
};

const GraphRenderer = () => {
   const BorderImageNodeProgram = useMemo(() => {
      const NodeBorderCustomProgram = createNodeBorderProgram({
         borders: [
            {
               size: { attribute: "borderSize", defaultValue: 2 },
               color: { attribute: "borderColor" },
            },
            { size: { fill: true }, color: { attribute: "color" } },
         ],
      });

      const NodePictogramCustomProgram = createNodeImageProgram();

      return createNodeCompoundProgram([NodeBorderCustomProgram, NodePictogramCustomProgram]);
   }, []);

   const customNodeReducer = (_n, attrs) => {
      if (
         graphHelper.getHighlightedGroups().length === 0 &&
         graphHelper.getHighlightedEdgeTypes().length === 0
      )
         return attrs;

      if (
         !graphHelper.isHighlighted(attrs.group) ||
         (graphHelper.getHighlightedGroups().length === 0 &&
            graphHelper.getHighlightedEdgeTypes().length > 0)
      ) {
         return {
            ...attrs,
            color: "rgba(145, 145, 145, 0.7)",
            borderColor: "rgba(145, 145, 145, 0.7)",
            type: "node",
            label: "",
            image: "",
         };
      }

      return {
         ...attrs,
         size: attrs.size * 2,
      };
   };

   const customEdgeReducer = (_e, attrs) => {
      if (
         graphHelper.getHighlightedEdgeTypes().length === 0 &&
         graphHelper.getHighlightedGroups().length === 0
      )
         return attrs;

      if (!graphHelper.isHighlighted(attrs.group)) {
         return {
            ...attrs,
            color: "rgba(145, 145, 145, 0.7)",
            label: "",
            size: 1,
         };
      }

      return {
         ...attrs,
         size: attrs.size * 1.5,
      };
   };

   return (
      <SigmaContainer
         style={{ maxWidth: "70%" }}
         graph={MultiUndirectedGraph}
         settings={{
            allowInvalidContainer: true,
            renderEdgeLabels: true,
            itemSizesReference: "screen",
            defaultDrawNodeLabel: drawLabel,
            defaultDrawNodeHover: drawHover,
            defaultNodeType: "node",
            labelDensity: 0.5,
            labelSize: 11,
            labelGridCellSize: 60,
            labelRenderedSizeThreshold: 6,
            hideEdgesOnMove: true,
            labelFont: "Lato, sans-serif",
            zIndex: true,
            nodeReducer: customNodeReducer,
            edgeReducer: customEdgeReducer,
            nodeProgramClasses: {
               nodeImg: BorderImageNodeProgram,
               node: NodeBorderProgram,
            },
            edgeProgramClasses: {
               straight: EdgeRectangleProgram,
               curved: EdgeCurveProgram,
            },
         }}
      >
         <Graph />
         <GraphEvents />
         <ControlsContainer position={"bottom-left"}>
            <ZoomControl />
            <FullScreenControl />
            <LayoutForceAtlas2Control
               settings={{
                  settings: {
                     adjustSizes: false,
                     barnesHutOptimize:
                        graphHelper.graph.order && graphHelper.graph.order < 200 ? false : true,
                     barnesHutTheta: 0.5,
                     edgeWeightInfluence: 1,
                     gravity: 0.05,
                     linLogMode: false,
                     outboundAttractionDistribution: true,
                     scalingRatio:
                        graphHelper.graph.order && graphHelper.graph.order < 200 ? 8 : 15,
                     slowDown: 8.2,
                     strongGravityMode: false,
                  },
               }}
            />
         </ControlsContainer>
      </SigmaContainer>
   );
};

export default GraphRenderer;
