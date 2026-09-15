import { useEffect, useState, useRef } from "react";
import { useRegisterEvents, useSigma } from "@react-sigma/core";
import GraphContextMenu from "../menus/GraphContextMenu";
import EditAttributesModal from "../modals/EditAttributesModal";
import graphHelper from "../../graph-helper/GraphHelper";
import { NewNodeModal, NewEdgeModal } from "../modals/NewObjectModal";
import UpdateDeviceModal from "../modals/UpdateDeviceModal";
import UpdateRegulatorModal from "../modals/UpdateRegulatorModal";
import { getControlType } from "../modals/device-control";
import { useShortcut } from "../../hooks/useShortcut";
import { formatPercent } from "../../utils/electrical";

const CLOSED_MENU = { open: false, x: 0, y: 0 };
const NO_CONTROL = { open: false, object: null, type: null };

// Edges have no hover card (sigma only draws one for nodes), so their live
// loading rides along on the hover label — the one place it can surface on the
// canvas itself. Falls back to just the name outside a simulation.
const edgeHoverLabel = (edgeId) => {
    const attrs = graphHelper.graph.getEdgeAttributes(edgeId);
    const name = attrs.attributes?.name ?? edgeId;

    const loading = graphHelper.getEdgeLoadingSummary(edgeId);
    if (loading?.ratio == null) return name;

    return `${name} · ${formatPercent(loading.ratio)} loaded`;
};

const GraphEvents = () => {
    const [context, setContext] = useState(CLOSED_MENU);
    const [attributesEditorContext, setAttributesEditorContext] = useState({
        open: false,
        object: null,
    });
    const [draggedNode, setDraggedNode] = useState(null);
    const [openNewNodeForm, setOpenNewNodeForm] = useState(false);
    const [openNewEdgeForm, setOpenNewEdgeForm] = useState(false);
    // `type` is "switch" | "capacitor" | "regulator"; `object` is the graph key.
    const [controlContext, setControlContext] = useState(NO_CONTROL);
    const sigma = useSigma();
    const registerEvents = useRegisterEvents();
    // Drag moves are coalesced to one position update per animation frame.
    const rafRef = useRef(null);
    const pendingPosRef = useRef(null);

    // Pin the camera to the graph's own bounds on the first render so sigma stops
    // autoscaling as nodes move. Deliberately its own effect: a raw sigma.on has
    // no automatic cleanup (unlike registerEvents), so living in the drag effect
    // below re-added a listener on every draggedNode change and stacked them
    // until sigma's emitter warned about a leak.
    useEffect(() => {
        const pinBBoxOnce = () => {
            if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
        };

        sigma.on("afterRender", pinBBoxOnce);
        return () => {
            sigma.off("afterRender", pinBBoxOnce);
        };
    }, [sigma]);

    useEffect(() => {
        const moveDraggedNode = ({ x, y }) => {
            graphHelper.graph.setNodeAttribute(draggedNode, "x", x);
            graphHelper.graph.setNodeAttribute(draggedNode, "y", y);
            sigma.refresh();
        };

        // Leaves dragging mode, flushing the last pending position.
        const endDrag = () => {
            if (draggedNode) {
                graphHelper.graph.removeNodeAttribute(draggedNode, "highlighted");
                document.body.style.cursor = "";

                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
                if (pendingPosRef.current) {
                    moveDraggedNode(pendingPosRef.current);
                    pendingPosRef.current = null;
                }
            }

            setDraggedNode(null);
        };

        const openControl = (object, attributes, elementType) => {
            const type = getControlType(attributes, elementType);
            if (type) setControlContext({ open: true, object, type });
        };

        registerEvents({
            downNode: (e) => {
                // Only allow left-click dragging
                if (e.event.original.button !== 0) return;

                document.body.style.cursor = "grabbing";
                setDraggedNode(e.node);
            },
            upNode: endDrag,
            upStage: endDrag,
            mouseup: endDrag,
            mousemovebody: (e) => {
                if (!draggedNode || graphHelper.graph.getNodeAttribute(draggedNode, "fixed")) return;

                pendingPosRef.current = sigma.viewportToGraph(e);

                if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(() => {
                        rafRef.current = null;
                        if (pendingPosRef.current) moveDraggedNode(pendingPosRef.current);
                        pendingPosRef.current = null;
                    });
                }

                // Prevent sigma from moving the camera
                e.preventSigmaDefault();
            },
            mousedown: () => {
                if (graphHelper.focusedNode) {
                    graphHelper.graph.setNodeAttribute(graphHelper.focusedNode, "highlighted", false);
                }

                setContext(CLOSED_MENU);
            },
            doubleClickEdge: (payload) => {
                payload.preventSigmaDefault();
                payload.event.original.preventDefault();
                payload.event.original.stopPropagation();

                openControl(payload.edge, graphHelper.graph.getEdgeAttributes(payload.edge), "edge");
            },
            doubleClickNode: (e) => {
                // Prevent default zoom behavior on double-click
                e.preventSigmaDefault();

                openControl(e.node, graphHelper.graph.getNodeAttributes(e.node), "node");
            },
            doubleClickStage: (e) => {
                e.preventSigmaDefault();
            },
            rightClickEdge: (payload) => {
                payload.preventSigmaDefault();
                payload.event.original.preventDefault();
                setContext({
                    open: true,
                    contextItems: "edgeItems",
                    edge: payload.edge,
                    x: payload.event.original.pageX,
                    y: payload.event.original.pageY,
                });

                // Stage the target for the editor without opening it — the
                // context menu's "Edit Attributes" item opens it.
                setAttributesEditorContext({
                    open: false,
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
                    open: false,
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
                if (graphHelper.graph.edges(e.node).length > 10) return;

                graphHelper.graph.edges(e.node).forEach((edgeId) => {
                    graphHelper.graph.setEdgeAttribute(edgeId, "label", edgeHoverLabel(edgeId));
                });
            },
            leaveNode: (e) => {
                graphHelper.graph.edges(e.node).forEach((edgeId) => {
                    graphHelper.graph.setEdgeAttribute(edgeId, "label", "");
                });
            },
            enterEdge: (e) => {
                graphHelper.graph.setEdgeAttribute(e.edge, "label", edgeHoverLabel(e.edge));
            },
            leaveEdge: (e) => {
                graphHelper.graph.setEdgeAttribute(e.edge, "label", "");
            },
        });
    }, [draggedNode, sigma, registerEvents]);

    const closeMenu = () => setContext(CLOSED_MENU);
    const closeControl = () => setControlContext(NO_CONTROL);

    // The context menu is a bare portal, not an antd overlay, so it has no
    // built-in dismiss key of its own.
    useShortcut("escape", closeMenu, { enabled: context.open });

    return (
        <>
            <GraphContextMenu
                context={context}
                close={closeMenu}
                openAttributesModal={() => setAttributesEditorContext((prev) => ({ ...prev, open: true }))}
                openNewNodeModal={() => setOpenNewNodeForm(true)}
                openNewEdgeModal={() => setOpenNewEdgeForm(true)}
            />
            <EditAttributesModal
                context={attributesEditorContext}
                close={() => setAttributesEditorContext({ open: false, object: null })}
            />
            <UpdateDeviceModal
                open={controlContext.open && controlContext.type !== "regulator"}
                object={controlContext.object}
                deviceType={controlContext.type}
                close={closeControl}
            />
            <UpdateRegulatorModal
                open={controlContext.open && controlContext.type === "regulator"}
                object={controlContext.object}
                close={closeControl}
            />
            <NewNodeModal open={openNewNodeForm} close={() => setOpenNewNodeForm(false)} />
            <NewEdgeModal open={openNewEdgeForm} close={() => setOpenNewEdgeForm(false)} />
        </>
    );
};

export default GraphEvents;
