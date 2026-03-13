import { createContext, useContext, useState, useCallback } from "react";

const GraphContext = createContext();

export const GraphProvider = ({ children }) => {
   const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);

   const newGraphUpdate = useCallback(() => {
      setGraphUpdateTrigger((prev) => prev + 1);
   }, []);

   return (
      <GraphContext.Provider value={{ graphUpdateTrigger, newGraphUpdate }}>
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
