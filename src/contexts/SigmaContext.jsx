import React, { createContext, useRef, useCallback } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const SigmaContext = createContext(null);

export function SigmaProvider({ children }) {
   const sigmaRef = useRef(null);
   const renderersRef = useRef(new Map()); // Store WebGL layer cleanup functions

   const setSigma = useCallback((sigma) => {
      sigmaRef.current = sigma;
   }, []);

   const getSigma = useCallback(() => {
      return sigmaRef.current;
   }, []);

   /**
    * Register a WebGL layer renderer so we can manage its lifecycle
    * @param {string} layerId - Unique identifier for the layer
    * @param {Function} cleanup - Cleanup function to remove the layer
    */
   const registerWebGLLayer = useCallback((layerId, cleanup) => {
      renderersRef.current.set(layerId, cleanup);
   }, []);

   /**
    * Unregister a WebGL layer and clean it up
    * @param {string} layerId - The layer ID to clean up
    */
   const unregisterWebGLLayer = useCallback((layerId) => {
      const cleanup = renderersRef.current.get(layerId);
      if (cleanup) {
         cleanup();
         renderersRef.current.delete(layerId);
      }
   }, []);

   /**
    * Clean up all WebGL layers
    */
   const cleanupAllWebGLLayers = useCallback(() => {
      renderersRef.current.forEach((cleanup) => {
         try {
            cleanup();
         } catch (e) {
            console.warn("Error cleaning up WebGL layer:", e);
         }
      });
      renderersRef.current.clear();
   }, []);

   const value = {
      setSigma,
      getSigma,
      registerWebGLLayer,
      unregisterWebGLLayer,
      cleanupAllWebGLLayers,
   };

   return <SigmaContext.Provider value={value}>{children}</SigmaContext.Provider>;
}
