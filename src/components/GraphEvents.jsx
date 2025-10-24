import React, { useEffect, useState, useRef } from "react";
import { useRegisterEvents, useSigma } from "@react-sigma/core";

const GraphEvents = () => {
   const [draggedNode, setDraggedNode] = useState(null);
   const sigma = useSigma();
   const registerEvents = useRegisterEvents();
   // Refs used for throttling position updates with requestAnimationFrame
   const rafRef = useRef(null);
   const pendingPosRef = useRef(null);

   useEffect(() => {
      const handleUp = () => {
         if (draggedNode) {
            // Remove the drag-related attributes so the layout can resume
            sigma.getGraph().removeNodeAttribute(draggedNode, "highlighted");
            // Cancel any pending RAF update and flush the last position
            if (rafRef.current) {
               cancelAnimationFrame(rafRef.current);
               rafRef.current = null;
            }

            if (pendingPosRef.current) {
               const p = pendingPosRef.current;
               sigma.getGraph().setNodeAttribute(draggedNode, "x", p.x);
               sigma.getGraph().setNodeAttribute(draggedNode, "y", p.y);
               sigma.refresh();
               pendingPosRef.current = null;
            }
         }

         setDraggedNode(null);
      };

      registerEvents({
         clickNode: (e) => console.log(sigma.getGraph().getNodeAttributes(e.node)),
         downNode: (e) => {
            if (typeof document !== "undefined" && document.body)
               document.body.style.cursor = "grabbing";
            setDraggedNode(e.node);
            // Mark node as highlighted and fixed so ForceAtlas2 won't override
            // the manual position updates while the user is dragging it.
            sigma.getGraph().setNodeAttribute(e.node, "highlighted", true);
            if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
         },
         upNode: handleUp,
         upStage: handleUp,
         mousemovebody: (e) => {
            if (
               !draggedNode ||
               (draggedNode && sigma.getGraph().getNodeAttribute(draggedNode, "fixed"))
            )
               return;

            // Convert viewport coordinates to graph coordinates and store
            // them in a pending ref. A RAF loop will consume the latest
            // pending position to avoid excessive attribute updates.
            const pos = sigma.viewportToGraph(e);
            pendingPosRef.current = pos;

            if (!rafRef.current) {
               rafRef.current = requestAnimationFrame(() => {
                  rafRef.current = null;

                  const p = pendingPosRef.current;
                  if (p && draggedNode) {
                     sigma.getGraph().setNodeAttribute(draggedNode, "x", p.x);
                     sigma.getGraph().setNodeAttribute(draggedNode, "y", p.y);
                     sigma.refresh();
                  }

                  pendingPosRef.current = null;
               });
            }

            // Prevent sigma to move camera:
            e.preventSigmaDefault();
            e.original.preventDefault();
            e.original.stopPropagation();
         },
         // On mouse up, we reset the autoscale and the dragging mode
         mouseup: () => {
            if (draggedNode) {
               setDraggedNode(null);
               sigma.getGraph().removeNodeAttribute(draggedNode, "highlighted");
               if (typeof document !== "undefined" && document.body)
                  document.body.style.cursor = "";

               if (rafRef.current) {
                  cancelAnimationFrame(rafRef.current);
                  rafRef.current = null;
               }

               if (pendingPosRef.current) {
                  const p = pendingPosRef.current;
                  sigma.getGraph().setNodeAttribute(draggedNode, "x", p.x);
                  sigma.getGraph().setNodeAttribute(draggedNode, "y", p.y);
                  sigma.refresh();
                  pendingPosRef.current = null;
               }
            }
         },
         // Disable the autoscale at the first down interaction
         mousedown: () => {
            if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
         },
         doubleClickEdge: ({ edge }) => {
            console.log(edge);
         },
      });
   }, [draggedNode, sigma, registerEvents]);

   return null;
};

export default GraphEvents;
