import graphHelper from "./GraphHelper";

const clearCurrentHighlight = () => {
    const current = graphHelper.getCurrentHighlightedObject();
    if (!current) return;

    if (current.type === "edge") {
        graphHelper.graph.setEdgeAttribute(current.id, "highlighted", false);
    } else {
        graphHelper.graph.setNodeAttribute(current.id, "highlighted", false);
    }
};

/** Focus the previous object in the highlighted set. */
export const goToPrevious = () => {
    if (graphHelper.highlightedObjects.length === 0) return;
    clearCurrentHighlight();
    graphHelper.focus(graphHelper.getPrevious());
};

/** Focus the next object in the highlighted set. */
export const goToNext = () => {
    if (graphHelper.highlightedObjects.length === 0) return;
    clearCurrentHighlight();
    graphHelper.focus(graphHelper.getNext());
};

/** Clear every highlight and focus. */
export const resetHighlight = () => {
    if (graphHelper.graph.order === 0) return;
    clearCurrentHighlight();

    graphHelper.reset();
    graphHelper.sigmaInstance?.refresh();
};
