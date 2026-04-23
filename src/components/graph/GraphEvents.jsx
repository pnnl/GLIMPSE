import React, { useEffect, useState, useRef } from "react";
import { useRegisterEvents, useSigma } from "@react-sigma/core";
import GraphContextMenu from "../menus/GraphContextMenu";
import EditAttributesModal from "../modals/EditAttributesModal";
import graphHelper from "../../graph-helper/GraphHelper";
import NewObjectModal from "../modals/NewObjectModal";

const GraphEvents = () => {
    const [context, setContext] = useState({ open: false, x: 0, y: 0 });
    const [attributesEditorContext, setAttributesEditorContext] = useState({
        open: false,
        object: null,
    });
    const [draggedNode, setDraggedNode] = useState(null);
    const [openNewNodeForm, setOpenNewNodeForm] = useState(false);
    const sigma = useSigma();
    const registerEvents = useRegisterEvents();
    // Refs used for throttling position updates with requestAnimationFrame
    const rafRef = useRef(null);
    const pendingPosRef = useRef(null);

    useEffect(() => {
        const handleUp = () => {
            if (draggedNode) {
                // Remove the drag-related attributes so the layout can resume
                graphHelper.graph.removeNodeAttribute(draggedNode, "highlighted");
                // Cancel any pending RAF update and flush the last position
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }

                if (pendingPosRef.current) {
                    const p = pendingPosRef.current;
                    graphHelper.graph.setNodeAttribute(draggedNode, "x", p.x);
                    graphHelper.graph.setNodeAttribute(draggedNode, "y", p.y);
                    sigma.refresh();
                    pendingPosRef.current = null;
                }
            }

            setDraggedNode(null);
        };

        registerEvents({
            clickNode: (e) => console.log(graphHelper.graph.getNodeAttributes(e.node)),
            downNode: (e) => {
                // Only allow left-click dragging (button 0)
                if (e.event.original.button !== 0) return;

                if (typeof document !== "undefined" && document.body)
                    document.body.style.cursor = "grabbing";
                setDraggedNode(e.node);
                // Mark node as highlighted and fixed so ForceAtlas2 won't override
                // the manual position updates while the user is dragging it.
                graphHelper.graph.setNodeAttribute(e.node, "highlighted", true);
                if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
            },
            upNode: handleUp,
            upStage: handleUp,
            mousemovebody: (e) => {
                if (
                    !draggedNode ||
                    (draggedNode && graphHelper.graph.getNodeAttribute(draggedNode, "fixed"))
                )
                    return;
                // Convert viewport coordinates to graph coordinates and store
                // them in a pending ref. A RAF loop will consume the latest
                // pending position to avoid excessive attribute updates.
                const pos = sigma.viewportToGraph(e);
                pendingPosRef.current = pos;

                if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(() => {
                        rafRef.current = null;

                        const p = pendingPosRef.current;
                        if (p && draggedNode) {
                            graphHelper.graph.setNodeAttribute(draggedNode, "x", p.x);
                            graphHelper.graph.setNodeAttribute(draggedNode, "y", p.y);
                            sigma.refresh();
                        }

                        pendingPosRef.current = null;
                    });
                }

                // Prevent sigma to move camera:
                e.preventSigmaDefault();
                e.original.preventDefault();
                e.original.stopPropagation();
            },
            // On mouse up, we reset the autoscale and the dragging mode
            mouseup: () => {
                if (draggedNode) {
                    setDraggedNode(null);
                    graphHelper.graph.removeNodeAttribute(draggedNode, "highlighted");
                    if (typeof document !== "undefined" && document.body)
                        document.body.style.cursor = "";

                    if (rafRef.current) {
                        cancelAnimationFrame(rafRef.current);
                        rafRef.current = null;
                    }

                    if (pendingPosRef.current) {
                        const p = pendingPosRef.current;
                        graphHelper.graph.setNodeAttribute(draggedNode, "x", p.x);
                        graphHelper.graph.setNodeAttribute(draggedNode, "y", p.y);
                        sigma.refresh();
                        pendingPosRef.current = null;
                    }
                }
            },
            // Disable the autoscale at the first down interaction
            mousedown: () => {
                if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
                // Close context menu on any click
                setContext({ open: false, x: 0, y: 0 });
            },
            doubleClickEdge: ({ edge }) => {
                console.log(edge);
            },
            rightClickEdge: (payload) => {
                console.log(graphHelper.graph.getEdgeAttributes(payload.edge));
                console.log(payload.edge);
                payload.preventSigmaDefault();
                payload.event.original.preventDefault();
                setContext({
                    open: true,
                    contextItems: "edgeItems",
                    edge: payload.edge,
                    x: payload.event.original.pageX,
                    y: payload.event.original.pageY,
                });

                setAttributesEditorContext({
                    ...EditAttributesModal,
                    object: { type: "edge", id: payload.edge },
                });
            },
            rightClickNode: (e) => {
                e.preventSigmaDefault();
                e.event.original.preventDefault();
                graphHelper.graph.setNodeAttribute(e.node, "highlighted", false);
                setContext({
                    open: true,
                    contextItems: "nodeItems",
                    node: e.node,
                    x: e.event.original.pageX,
                    y: e.event.original.pageY,
                });

                setAttributesEditorContext({
                    ...EditAttributesModal,
                    object: { type: "node", id: e.node },
                });
            },
            rightClickStage: (e) => {
                e.preventSigmaDefault();
                e.event.original.preventDefault();
                setContext({
                    open: true,
                    contextItems: "graphItems",
                    x: e.event.original.pageX,
                    y: e.event.original.pageY,
                });
            },
            enterNode: (e) => {
                graphHelper.graph.edges(e.node).forEach((edgeId) => {
                    const attrs = graphHelper.graph.getEdgeAttributes(edgeId);
                    graphHelper.graph.setEdgeAttribute(
                        edgeId,
                        "label",
                        attrs.attributes.name ?? edgeId,
                    );
                });
            },
            leaveNode: (e) => {
                graphHelper.graph.edges(e.node).forEach((edgeId) => {
                    graphHelper.graph.setEdgeAttribute(edgeId, "label", "");
                });
            },
            enterEdge: (e) => {
                const attrs = graphHelper.graph.getEdgeAttributes(e.edge);
                graphHelper.graph.setEdgeAttribute(
                    e.edge,
                    "label",
                    attrs.attributes.name ?? e.edge,
                );
            },
            leaveEdge: (e) => {
                graphHelper.graph.setEdgeAttribute(e.edge, "label", "");
            },
        });
    }, [draggedNode, sigma, registerEvents]);

    const handleClose = () => {
        setContext({ open: false, x: 0, y: 0 });
    };

    const closeAttributesEditor = () => {
        setAttributesEditorContext({ open: false, object: null });
    };

    const openAttributesModal = () => {
        setAttributesEditorContext({ ...attributesEditorContext, open: true });
    };

    return (
        <>
            <GraphContextMenu
                context={context}
                close={handleClose}
                openAttributesModal={openAttributesModal}
                openNewNodeModal={() => setOpenNewNodeForm(true)}
            />
            <EditAttributesModal context={attributesEditorContext} close={closeAttributesEditor} />
            <NewObjectModal open={openNewNodeForm} close={() => setOpenNewNodeForm(false)} />
        </>
    );
};

export default GraphEvents;
