import { useState, useEffect } from "react";
import { Flex } from "antd";
import "../styles/GraphLayout.css";
import VisToolbar from "../components/VisToolbar";
import GraphRenderer from "../components/graph/GraphRenderer";
import LegendRenderer from "../components/legend/LegendRenderer";
import SimulationCharts from "../components/SimulationCharts";
import graphHelper from "../graph-helper/GraphHelper";
import { useGraph } from "../contexts/GraphContext";

// activePanel: "charts" | "legend" | null
const GraphLayout = () => {
   const { graphUpdateTrigger, darkMode } = useGraph();
   const [activePanel, setActivePanel] = useState("legend");
   const [isCIM, setIsCIM] = useState(false);

   const rightPanelVisible = activePanel !== null;

   // Track CIM model status and auto-switch panels when model type changes
   useEffect(() => {
      const cim = graphHelper.isCIM;
      setIsCIM(cim);
      // CIM model loaded → show charts; non-CIM loaded → fall back to legend
      setActivePanel(cim ? "charts" : "legend");
   }, [graphUpdateTrigger]);

   // Let sigma recalculate after the graph container resizes
   useEffect(() => {
      const id = requestAnimationFrame(() => graphHelper.sigmaInstance?.refresh());
      return () => cancelAnimationFrame(id);
   }, [rightPanelVisible]);

   // Clicking the active panel's button collapses the right panel; clicking the
   // other panel's button switches to it.
   const toggleCharts = () => setActivePanel((v) => (v === "charts" ? null : "charts"));
   const toggleLegend = () => setActivePanel((v) => (v === "legend" ? null : "legend"));

   const border = darkMode ? "#3a3a3a" : "#e0e0e0";

   return (
      <div className="graph-layout">
         <VisToolbar
            onToggleLegend={toggleLegend}
            onToggleCharts={toggleCharts}
            activePanel={activePanel}
            isCIM={isCIM}
         />
         <Flex direction="row" gap="0" style={{ height: "inherit", width: "100%" }}>

            {/* Main graph — expands when right panel is hidden */}
            <div style={{ width: rightPanelVisible ? "70%" : "100%", height: "100%" }}>
               <GraphRenderer />
            </div>

            {/* Right panel */}
            <div style={{
               display: rightPanelVisible ? "block" : "none",
               width: "30%",
               height: "100%",
               position: "relative",
               overflow: "hidden",
               borderLeft: `1px solid ${border}`,
            }}>
               {/* Charts: only mounted for GridAPPS-D CIM models.
                   visibility (not display) preserves layout dimensions so
                   ECharts can measure its container on mount. */}
               {isCIM && (
                  <div style={{
                     visibility: activePanel === "charts" ? "visible" : "hidden",
                     pointerEvents: activePanel === "charts" ? "auto" : "none",
                     display: "flex",
                     flexDirection: "column",
                     position: "absolute",
                     inset: 0,
                     overflowY: "auto",
                     zIndex: activePanel === "charts" ? 1 : 0,
                  }}>
                     <SimulationCharts />
                  </div>
               )}

               {/* Legend */}
               <div style={{
                  display: activePanel === "legend" ? "block" : "none",
                  position: "absolute",
                  inset: 0,
               }}>
                  <LegendRenderer />
               </div>
            </div>

         </Flex>
      </div>
   );
};

export default GraphLayout;
