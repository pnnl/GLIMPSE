import React, { useEffect, useMemo } from "react";
import { useLoadGraph } from "@react-sigma/core";
import { MultiGraph } from "graphology";
import graphHelper from "../graphHelper/GraphHelper";
import LegendGraphEvents from "./LegendGraphEvents";
import { SigmaContainer } from "@react-sigma/core";
import { EdgeRectangleProgram } from "sigma/rendering";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { createNodeCompoundProgram } from "sigma/rendering";
import { createNodeImageProgram } from "@sigma/node-image";
import { drawLabel, drawShadow } from "../utils/canvas-utils";

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
         style={{ maxWidth: "30%" }}
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
