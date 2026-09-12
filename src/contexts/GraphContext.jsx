import { createContext, useContext, useState, useCallback } from "react";

const GraphContext = createContext();

export const GraphProvider = ({ children }) => {
    const [graphUpdateTrigger, setGraphUpdateTrigger] = useState(0);
    const [view, setView] = useState("graph"); // "graph", "object-studio" or "agents"
    const [darkMode, setDarkMode] = useState(true);
    // Whether the leaflet map background is up. Owned here rather than by
    // GraphControls because the map's tiles are light in both themes, so
    // GraphRenderer has to paint the graph in its light colors while it shows.
    const [mapShown, setMapShown] = useState(false);

    const newGraphUpdate = useCallback(() => {
        // A new graph remounts SigmaContainer, which drops the bound map layer.
        setMapShown(false);
        setGraphUpdateTrigger((prev) => prev + 1);
    }, []);

    return (
        <GraphContext.Provider
            value={{
                graphUpdateTrigger,
                newGraphUpdate,
                view,
                setView,
                darkMode,
                setDarkMode,
                mapShown,
                setMapShown,
            }}
        >
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
