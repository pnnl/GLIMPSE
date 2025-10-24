import React, { useEffect } from "react";
import { useRegisterEvents } from "@react-sigma/core";
import graphHelper from "../graphHelper/GraphHelper";

const LegendGraphEvents = () => {
   const registerEvents = useRegisterEvents();

   useEffect(() => {
      registerEvents({
         enterNode: () => {
            document.body.style.cursor = "pointer";
         },
         leaveNode: () => {
            document.body.style.cursor = "";
         },
         doubleClickNode: ({ node: group }) => {
            graphHelper.highlightGroup(group);
            graphHelper.sigmaInstance.refresh();
         },
         enterEdge: () => (document.body.style.cursor = "pointer"),
         leaveEdge: () => (document.body.style.cursor = ""),
         doubleClickEdge: ({ edge: edgeType }) => {
            graphHelper.highlightEdgeTypes(edgeType);
            graphHelper.sigmaInstance.refresh();
         },
      });
   }, [registerEvents]);

   return null;
};

export default LegendGraphEvents;
