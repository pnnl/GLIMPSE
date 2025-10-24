import "@react-sigma/core/lib/style.css";
import { useMemo, useState, useCallback } from "react";
import {
   SigmaContainer,
   ControlsContainer,
   ZoomControl,
   FullScreenControl,
} from "@react-sigma/core";
import { LayoutForceAtlas2Control } from "@react-sigma/layout-forceatlas2";
import { MultiGraph, MultiUndirectedGraph } from "graphology";
import { EdgeRectangleProgram } from "sigma/rendering";
import { createNodeImageProgram } from "@sigma/node-image";
import { drawHover, drawLabel, drawShadow } from "../utils/canvas-utils";
import { Flex } from "antd";
import { createNodeBorderProgram, NodeBorderProgram } from "@sigma/node-border";
import { createNodeCompoundProgram } from "sigma/rendering";
import graphHelper from "../graphHelper/GraphHelper";
import VisToolbar from "../components/VisToolbar";
import GraphEvents from "../components/GraphEvents";
import EdgeCurveProgram from "@sigma/edge-curve";
import Graph from "../components/Graph";
import LegendGraph from "../components/LegendGraph";
import LegendGraphEvents from "../components/LegendGraphEvents";
import { LayoutForceControl } from "@react-sigma/layout-force";

const GraphView = () => {
   const [graphOrder, setGraphOrder] = useState(graphHelper.graph ? graphHelper.graph.order : 0);

   const onGraphLoaded = useCallback((order) => {
      // Update local state when Graph component loads or clears a graph
      setGraphOrder(typeof order === "number" ? order : 0);
   }, []);

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

   const customNodeReducer = (n, attrs) => {
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

   const customEdgeReducer = (e, attrs) => {
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
      <>
         <VisToolbar />
         <Flex style={{ height: "calc(100% - 4.5rem)" }}>
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
               <Graph onGraphLoaded={onGraphLoaded} />
               <GraphEvents />
               <ControlsContainer position={"bottom-left"}>
                  <ZoomControl />
                  <FullScreenControl />
                  {graphOrder < 150 ? (
                     <LayoutForceControl settings={{ settings: { gravity: 0.0003 } }} />
                  ) : (
                     <LayoutForceAtlas2Control
                        settings={{
                           settings: {
                              adjustSizes: false,
                              barnesHutOptimize: graphOrder < 200 ? false : true,
                              barnesHutTheta: 0.5,
                              edgeWeightInfluence: 1,
                              gravity: 0.05,
                              linLogMode: false,
                              outboundAttractionDistribution: true,
                              scalingRatio: graphOrder < 200 ? 8 : 15,
                              slowDown: 8.2,
                              strongGravityMode: false,
                           },
                        }}
                     />
                  )}
               </ControlsContainer>
            </SigmaContainer>
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
         </Flex>
      </>
   );
};

export default GraphView;
