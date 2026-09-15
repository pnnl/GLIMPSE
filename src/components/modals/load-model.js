import graphHelper from "../../graph-helper/GraphHelper";

/**
 * Swaps graphHelper over to a freshly parsed model. Callers still own the
 * simulation lifecycle, the "graph-loaded" event and newGraphUpdate().
 */
export const replaceModel = (response, isCIM) => {
    if ("error" in response) throw new Error(response.error);

    if (graphHelper.graph.order > 0) {
        graphHelper.clearGraphData();
        window.dispatchEvent(new CustomEvent("graph-cleared"));
    }

    graphHelper.setIsCIM(isCIM);
    graphHelper.setThemeObject(response.themeData ?? null);
    graphHelper.setObjectDetails(response.objectDetails);
    graphHelper.setGraphData(response.data ?? response);
};
