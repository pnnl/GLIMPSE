import React, { useRef, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { Menu } from "antd";
import { downloadAsImage } from "@sigma/export-image";
import graphHelper from "../../graph-helper/GraphHelper";
import NewObjectModal from "../modals/NewObjectModal";

const NODE_ITEMS = [
    { key: "edit-attributes", label: "Edit Attributes" },
    { type: "divider" },
    { key: "delete-node", label: "Delete Node" },
];
const EDGE_ITEMS = [
    { key: "edit-attributes", label: "Edit Attributes" },
    { key: "hide-edge", label: "Hide Edge", disabled: false },
    { key: "animate-edge", label: "Toggle Animation", disabled: false },
    { type: "divider" },
    { key: "delete-edge", label: "Delete Edge" },
];
const GRAPH_ITEMS = [
    { key: "new-node", label: "Add New Node", disabled: false },
    { key: "new-edge", label: "Add New Edge", disabled: false },
    { type: "divider" },
    { key: "save-image", label: "Save image as..." },
];

const ITEMS = {
    nodeItems: NODE_ITEMS,
    edgeItems: EDGE_ITEMS,
    graphItems: GRAPH_ITEMS,
};

const GraphContextMenu = ({
    context,
    close,
    openAttributesModal,
    openNewNodeModal,
    openNewEdgeModal,
}) => {
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ x: context.x, y: context.y });

    useEffect(() => {
        if (!context.open || !menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let x = context.x;
        let y = context.y;

        if (x + rect.width > vw) x = vw - rect.width;
        if (y + rect.height > vh) y = vh - rect.height;
        if (x < 0) x = 0;
        if (y < 0) y = 0;

        setPosition({ x, y });
    }, [context.open, context.x, context.y]);

    if (!context.open) return null;

    const deleteNode = (nodeID) => {
        console.log(`Deleting node with ID: ${nodeID}`);
        graphHelper.graph.dropNode(nodeID);
        graphHelper.sigmaInstance.refresh();
    };

    const deleteEdge = (edgeID) => {
        console.log(`Deleting edge with ID: ${edgeID}`);
        graphHelper.graph.dropEdge(edgeID);
        graphHelper.sigmaInstance.refresh();
    };

    const handleImageSave = () => {
        downloadAsImage(graphHelper.sigmaInstance, {
            backgroundColor: "#FFFFFF",
            fileName: "GLIMPSE-snapshot",
            format: "png",
            layers: ["edges", "nodes", "labels"],
        });
    };

    /**
     * Updates the type of the edge from `"straight"` to `"animated"`
     * @param {string} edgeID
     */
    const animateEdge = (edgeID) => {
        const currentEdgeType = graphHelper.graph.getEdgeAttribute(edgeID, "type");
        const edgeGroup = graphHelper.graph.getEdgeAttribute(edgeID, "group");

        if (currentEdgeType === "animated") {
            if (edgeGroup === "switch") {
                graphHelper.graph.setEdgeAttribute(edgeID, "type", "switch");
                return;
            }

            graphHelper.graph.setEdgeAttribute(edgeID, "type", "straight");
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
        console.log(`Clicked on menu item: ${key}`);

        switch (key) {
            case "edit-attributes":
                openAttributesModal();
                break;
            case "hide-edge":
                hideEdge(context.edge);
                break;
            case "delete-node":
                deleteNode(context.node);
                break;
            case "delete-edge":
                deleteEdge(context.edge);
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
            default:
        }

        close();
    };

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex: 1000,
            }}
        >
            <Menu
                style={{
                    width: "9.5rem",
                    borderRadius: "0.4rem",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                }}
                onClick={handleMenuClick}
                items={ITEMS[context.contextItems]}
            />
        </div>,
        document.getElementById("portal"),
    );
};

export default GraphContextMenu;
