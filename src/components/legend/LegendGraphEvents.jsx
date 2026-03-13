import React, { useEffect } from "react";
import { useRegisterEvents } from "@react-sigma/core";
import graphHelper from "../../graph-helper/GraphHelper";
import LegendContextMenu from "../menus/LegendContextMenu";

const LegendGraphEvents = () => {
   const [context, setContext] = React.useState({ open: false, x: 0, y: 0 });
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
         mousedown: () => {
            setContext({ open: false, x: 0, y: 0 });
         },
         rightClickEdge: (e) => {
            e.preventSigmaDefault();
            e.event.original.preventDefault();
            setContext({
               open: true,
               type: "edge",
               group: e.edge,
               x: e.event.original.pageX,
               y: e.event.original.pageY,
            });
         },
         rightClickNode: (e) => {
            e.preventSigmaDefault();
            e.event.original.preventDefault();
            setContext({
               open: true,
               type: "node",
               group: e.node,
               x: e.event.original.pageX,
               y: e.event.original.pageY,
            });
         },
      });
   }, [registerEvents]);

   const handleClose = () => {
      setContext({ open: false, x: 0, y: 0 });
   };

   const handleHideAll = (type, group) => {
      graphHelper.hideGroup(type, group);
      graphHelper.sigmaInstance.refresh();
   };

   const handleEditTheme = (type, group) => {
      console.log(type, group);
   };

   return (
      <LegendContextMenu
         onHideAll={handleHideAll}
         onEditTheme={handleEditTheme}
         context={context}
         close={handleClose}
      />
   );
};

export default LegendGraphEvents;
