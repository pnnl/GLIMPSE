import { createContext, useContext, useState, useCallback } from "react";
import graphHelper from "../graph-helper/GraphHelper";

const GraphContext = createContext();

export const GraphProvider = ({ children }) => {
   const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);

   const setGraphData = useCallback((fileData) => {
      graphHelper.clearGraphData();
      graphHelper.setGraphData(fileData);
      // Trigger a re-render of components that depend on graph data
      setGraphUpdateTrigger((prev) => prev + 1);
   }, []);

   return (
      <GraphContext.Provider value={{ graphUpdateTrigger, setGraphData }}>
         {children}
      </GraphContext.Provider>
   );
};

export const useGraph = () => {
   const context = useContext(GraphContext);
   if (!context) {
      throw new Error("useGraph must be used within a GraphProvider");
   }
   return context;
};
