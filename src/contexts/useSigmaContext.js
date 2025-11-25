import { useContext } from "react";
import { SigmaContext } from "./SigmaContext";

/**
 * Hook to use the Sigma context throughout your app.
 * Access the raw Sigma instance and manage WebGL layers.
 *
 * @example
 * const { getSigma, registerWebGLLayer } = useSigmaContext();
 * const sigma = getSigma();
 *
 * @returns {Object} Sigma context object with:
 *   - getSigma(): Get the current Sigma instance
 *   - setSigma(sigma): Set the Sigma instance (called by GraphRenderer)
 *   - registerWebGLLayer(layerId, cleanup): Register a WebGL layer
 *   - unregisterWebGLLayer(layerId): Unregister and cleanup a layer
 *   - cleanupAllWebGLLayers(): Remove all registered layers
 */
export function useSigmaContext() {
   const context = useContext(SigmaContext);
   if (!context) {
      throw new Error("useSigmaContext must be used within SigmaProvider");
   }
   return context;
}
