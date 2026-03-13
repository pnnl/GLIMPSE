import { useRef } from "react";
import { Flex } from "antd";
import "../styles/GraphLayout.css";
import VisToolbar from "../components/VisToolbar";
import GraphRenderer from "../components/graph/GraphRenderer";
import LegendRenderer from "../components/legend/LegendRenderer";
import graphHelper from "../graph-helper/GraphHelper";

const GraphLayout = () => {
   const graphRef = useRef(null);
   const legendRef = useRef(null);

   const toggleLegend = () => {
      if (graphRef.current.style.width === "100%") {
         graphRef.current.style.width = "70%";
         legendRef.current.style.display = "block";
         graphHelper.sigmaInstance.refresh();

         return;
      }

      graphRef.current.style.width = "100%";
      legendRef.current.style.display = "none";
      graphHelper.sigmaInstance.refresh();
   };

   return (
      <div className="graph-layout">
         <VisToolbar onToggleLegend={toggleLegend} />
         <Flex direction="row" gap="0" style={{ height: "inherit", width: "100%" }}>
            <div ref={graphRef} style={{ width: "70%", height: "100%" }}>
               <GraphRenderer />
            </div>
            <div ref={legendRef} style={{ width: "30%", height: "100%" }}>
               <LegendRenderer />
            </div>
         </Flex>
      </div>
   );
};

export default GraphLayout;
