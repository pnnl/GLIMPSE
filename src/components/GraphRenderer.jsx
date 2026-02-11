import "@react-sigma/core/lib/style.css";
import { useMemo } from "react";
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
import { drawLabel, drawHover } from "../utils/canvas-utils";
import graphHelper from "../graph-helper/GraphHelper";
import GraphEvents from "./GraphEvents";
import EdgeCurveProgram from "@sigma/edge-curve";
import Graph from "./Graph";

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
      ) {
         return attrs;
      }

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
            hideLabelsOnMove: true,
            labelFont: "Lato, sans-serif",
            zIndex: true,
            nodeReducer: customNodeReducer,
            edgeReducer: customEdgeReducer,
            enableEdgeEvents: true,
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
                     barnesHutTheta: 0.6,
                     edgeWeightInfluence: 2.5,
                     gravity: 0.09,
                     linLogMode: false,
                     outboundAttractionDistribution: true,
                     scalingRatio:
                        graphHelper.graph.order && graphHelper.graph.order < 200 ? 8 : 15,
                     slowDown: 10,
                     strongGravityMode: false,
                  },
               }}
            />
         </ControlsContainer>
      </SigmaContainer>
   );
};

export default GraphRenderer;
