import { createContext, useContext, useState, useCallback } from "react";

const GraphContext = createContext();

export const GraphProvider = ({ children }) => {
    const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);
    const [view, setView] = useState("graph"); // "graph" or "object-studio"
    const [darkMode, setDarkMode] = useState(false);

    const newGraphUpdate = useCallback(() => {
        setGraphUpdateTrigger((prev) => prev + 1);
    }, []);

    return (
        <GraphContext.Provider value={{ graphUpdateTrigger, newGraphUpdate, view, setView, darkMode, setDarkMode }}>
            {children}
        </GraphContext.Provider>
    );
};

// Keeping the hook beside its provider is the standard context pattern; the
// only cost is full-reload (instead of fast-refresh) HMR for this one file.
// eslint-disable-next-line react-refresh/only-export-components
export const useGraph = () => {
    const context = useContext(GraphContext);
    if (!context) {
        throw new Error("useGraph must be used within a GraphProvider");
    }
    return context;
};
