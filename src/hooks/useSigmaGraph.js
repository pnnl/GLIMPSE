import { useCallback } from "react";
import { useSigmaContext } from "../contexts/useSigmaContext";
import graphHelper from "../graphHelper/GraphHelper";

/**
 * Custom hook demonstrating best practices for:
 * 1. Accessing Sigma instance safely
 * 2. Batching graph updates
 * 3. Triggering UI refresh
 * 4. Handling async operations
 */
export function useSigmaGraph() {
   const { getSigma } = useSigmaContext();

   /**
    * Safely get the Sigma instance with error checking
    */
   const getSigmaInstance = useCallback(() => {
      const sigma = getSigma();
      if (!sigma) {
         console.warn("Sigma instance not yet initialized");
         return null;
      }
      return sigma;
   }, [getSigma]);

   /**
    * Highlight nodes and animate camera to them
    */
   const highlightAndFocus = useCallback(
      (nodeIds) => {
         const sigma = getSigmaInstance();
         if (!sigma || !graphHelper.graph) return;

         // Clear previous highlights
         graphHelper.graph.forEachNode((n) => {
            graphHelper.graph.setNodeAttribute(n, "highlighted", false);
         });

         // Set new highlights
         nodeIds.forEach((nodeId) => {
            if (graphHelper.graph.hasNode(nodeId)) {
               graphHelper.graph.setNodeAttribute(nodeId, "highlighted", true);
            }
         });

         // Calculate center position of all highlighted nodes
         if (nodeIds.length > 0) {
            const displayData = nodeIds
               .map((nodeId) => sigma.getNodeDisplayData(nodeId))
               .filter(Boolean);

            if (displayData.length > 0) {
               const avgX = displayData.reduce((sum, d) => sum + d.x, 0) / displayData.length;
               const avgY = displayData.reduce((sum, d) => sum + d.y, 0) / displayData.length;

               // Animate camera to center
               sigma
                  .getCamera()
                  .animate(
                     { x: avgX, y: avgY, ratio: 0.1 },
                     { duration: 1000, easing: "quadraticInOut" }
                  );
            }
         }

         // Refresh to apply visual changes
         sigma.refresh();
      },
      [getSigmaInstance]
   );

   /**
    * Toggle node attribute (useful for selections, highlighting, etc)
    */
   const toggleNodeAttribute = useCallback(
      (nodeId, attributeName, defaultValue = false) => {
         const sigma = getSigmaInstance();
         if (!sigma || !graphHelper.graph) return;

         if (!graphHelper.graph.hasNode(nodeId)) {
            console.warn(`Node ${nodeId} not found in graph`);
            return;
         }

         const currentValue =
            graphHelper.graph.getNodeAttribute(nodeId, attributeName) ?? defaultValue;
         graphHelper.graph.setNodeAttribute(nodeId, attributeName, !currentValue);

         sigma.refresh();
      },
      [getSigmaInstance]
   );

   /**
    * Batch update multiple node attributes (more efficient)
    */
   const batchUpdateNodes = useCallback(
      (updates) => {
         const sigma = getSigmaInstance();
         if (!sigma || !graphHelper.graph) return;

         // updates: { nodeId: { attrName: value, ... }, ... }
         Object.entries(updates).forEach(([nodeId, attributes]) => {
            if (graphHelper.graph.hasNode(nodeId)) {
               Object.entries(attributes).forEach(([attrName, value]) => {
                  graphHelper.graph.setNodeAttribute(nodeId, attrName, value);
               });
            }
         });

         sigma.refresh();
      },
      [getSigmaInstance]
   );

   /**
    * Get node display data (position on screen)
    */
   const getNodeDisplayData = useCallback(
      (nodeId) => {
         const sigma = getSigmaInstance();
         if (!sigma) return null;

         return sigma.getNodeDisplayData(nodeId);
      },
      [getSigmaInstance]
   );

   /**
    * Get camera state
    */
   const getCameraState = useCallback(() => {
      const sigma = getSigmaInstance();
      if (!sigma) return null;

      return sigma.getCamera().getState();
   }, [getSigmaInstance]);

   /**
    * Animate camera to position
    */
   const animateCamera = useCallback(
      (targetX, targetY, targetRatio = 1, duration = 1000) => {
         const sigma = getSigmaInstance();
         if (!sigma) return;

         sigma
            .getCamera()
            .animate(
               { x: targetX, y: targetY, ratio: targetRatio },
               { duration, easing: "quadraticInOut" }
            );
      },
      [getSigmaInstance]
   );

   return {
      getSigma: getSigmaInstance,
      highlightAndFocus,
      toggleNodeAttribute,
      batchUpdateNodes,
      getNodeDisplayData,
      getCameraState,
      animateCamera,
   };
}

export default useSigmaGraph;
