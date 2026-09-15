import { downloadAsImage } from "@sigma/export-image";
import { useGraph } from "../../contexts/GraphContext";
import graphHelper from "../../graph-helper/GraphHelper";
import ContextMenu from "./ContextMenu";

const ITEMS = {
    nodeItems: [
        { key: "edit-attributes", label: "Edit Attributes" },
        { type: "divider" },
        { key: "delete-node", label: "Delete Node" },
    ],
    edgeItems: [
        { key: "edit-attributes", label: "Edit Attributes" },
        { key: "hide-edge", label: "Hide Edge" },
        { key: "animate-edge", label: "Toggle Animation" },
        { type: "divider" },
        { key: "delete-edge", label: "Delete Edge" },
    ],
    graphItems: [
        { key: "new-node", label: "Add New Node" },
        { key: "new-edge", label: "Add New Edge" },
        { type: "divider" },
        { key: "save-image", label: "Save image as..." },
    ],
};

const GraphContextMenu = ({
    context,
    close,
    openAttributesModal,
    openNewNodeModal,
    openNewEdgeModal,
}) => {
    const { darkMode } = useGraph();

    const handleImageSave = () => {
        // Match the canvas background of the active theme — node labels are drawn
        // white in dark mode, so a fixed white background exported them invisible.
        downloadAsImage(graphHelper.sigmaInstance, {
            backgroundColor: darkMode ? "#1D1D1D" : "#FFFFFF",
            fileName: "GLIMPSE-snapshot",
            format: "png",
            layers: ["edges", "nodes", "labels"],
        });
    };

    // Toggles an edge between the "animated" program and its resting type.
    const animateEdge = (edgeID) => {
        const { type, group } = graphHelper.graph.getEdgeAttributes(edgeID);

        if (type === "animated") {
            graphHelper.graph.setEdgeAttribute(edgeID, "type", group === "switch" ? "switch" : "straight");
            return;
        }

        graphHelper.graph.setEdgeAttribute(edgeID, "type", "animated");
        graphHelper.sigmaInstance.refresh();
    };

    const hideEdge = (edgeID) => {
        graphHelper.graph.setEdgeAttribute(edgeID, "hidden", true);
        graphHelper.sigmaInstance.refresh();
    };

    const handleMenuClick = ({ key }) => {
        switch (key) {
            case "edit-attributes":
                openAttributesModal();
                break;
            case "hide-edge":
                hideEdge(context.edge);
                break;
            // Deletes go through the helper rather than graph.dropNode/dropEdge so
            // objectTypeCount and the legend stay in sync.
            case "delete-node":
                if (graphHelper.deleteNode(context.node)) graphHelper.markDirty();
                break;
            case "delete-edge":
                if (graphHelper.deleteEdge(context.edge)) graphHelper.markDirty();
                break;
            case "animate-edge":
                animateEdge(context.edge);
                break;
            case "new-node":
                openNewNodeModal();
                break;
            case "new-edge":
                openNewEdgeModal();
                break;
            case "save-image":
                handleImageSave();
                break;
        }

        close();
    };

    return (
        <ContextMenu
            context={context}
            width="9.5rem"
            items={ITEMS[context.contextItems]}
            onClick={handleMenuClick}
        />
    );
};

export default GraphContextMenu;
