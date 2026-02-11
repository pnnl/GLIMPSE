import { useEffect, useMemo } from "react";
import { useLoadGraph } from "@react-sigma/core";
import { MultiGraph } from "graphology";
import graphHelper from "../graph-helper/GraphHelper";
import LegendGraphEvents from "./LegendGraphEvents";
import { SigmaContainer } from "@react-sigma/core";
import { EdgeRectangleProgram } from "sigma/rendering";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { createNodeCompoundProgram } from "sigma/rendering";
import { createNodeImageProgram } from "@sigma/node-image";
import { drawLabel, drawShadow } from "../utils/canvas-utils";
import { useGraph } from "../contexts/GraphContext";

const LegendGraph = () => {
   const loadLegendGraph = useLoadGraph();
   const { graphUpdateTrigger } = useGraph();

   useEffect(() => {
      try {
         if (graphHelper.legendGraph.order > 0) {
            console.log("Loading legend graph with order:", graphHelper.legendGraph.order);
            loadLegendGraph(graphHelper.legendGraph);
         }
      } catch (error) {
         console.error("Error loading legend graph:", error);
      }
   }, [loadLegendGraph, graphUpdateTrigger]);

   return null;
};

const LegendRenderer = () => {
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

   return (
      <SigmaContainer
         settings={{
            allowInvalidContainer: true,
            renderEdgeLabels: true,
            defaultEdgeType: "straight",
            defaultDrawNodeLabel: drawLabel,
            defaultDrawNodeHover: drawShadow,
            labelSize: 12,
            defaultNodeType: "node",
            enableCameraPanning: false,
            enableCameraZooming: false,
            enableEdgeEvents: true,
            autoCenter: true,
            nodeProgramClasses: {
               nodeImg: BorderImageNodeProgram,
               node: NodeBorderProgram,
            },
            edgeProgramClasses: {
               straight: EdgeRectangleProgram,
            },
         }}
         graph={MultiGraph}
      >
         <LegendGraph />
         <LegendGraphEvents />
      </SigmaContainer>
   );
};

export default LegendRenderer;
