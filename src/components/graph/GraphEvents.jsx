import { useEffect, useState } from "react";
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
    const [openNewNodeForm, setOpenNewNodeForm] = useState(false);
    const [openNewEdgeForm, setOpenNewEdgeForm] = useState(false);
    // `type` is "switch" | "capacitor" | "regulator"; `object` is the graph key.
    const [controlContext, setControlContext] = useState(NO_CONTROL);
    const sigma = useSigma();
    const registerEvents = useRegisterEvents();

    // Pin the camera to the graph's own bounds on the first render so sigma stops
    // autoscaling as nodes move. Deliberately its own effect: a raw sigma.on has
    // no automatic cleanup (unlike registerEvents), so living in the drag effect
    // below re-added a listener on every drag and stacked them
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
        // Sigma state, not a graph attribute: any edge attribute write makes sigma
        // reprocess the whole graph, while a state change restyles just that edge.
        // GraphRenderer's edge style reads `hoverLabel`.
        const showEdgeLabel = (edgeId) => sigma.setEdgeState(edgeId, { hoverLabel: edgeHoverLabel(edgeId) });
        const hideEdgeLabel = (edgeId) => sigma.setEdgeState(edgeId, { hoverLabel: null });

        const openControl = (object, attributes, elementType) => {
            const type = getControlType(attributes, elementType);
            if (type) setControlContext({ open: true, object, type });
        };

        registerEvents({
            // Sigma's own drag: it moves the node, keeps it hovered and flags it
            // `isDragged` (GraphRenderer hides the card on that state).
            nodeDragStart: (e) => {
                // Model-placed nodes stay put (the press pans instead); left button only.
                if (graphHelper.graph.getNodeAttribute(e.node, "fixed") || e.event.original.buttons !== 1) {
                    e.preventSigmaDefault();
                    return;
                }

                document.body.style.cursor = "grabbing";
                // Sigma counts a node drag as camera movement, and hideLabelsOnMove
                // would blank every label for the whole drag.
                sigma.setSetting("hideLabelsOnMove", false);
            },
            nodeDragEnd: () => {
                document.body.style.cursor = "";
                sigma.setSetting("hideLabelsOnMove", true);
            },
            mousedown: () => {
                // The focused node can be gone (model reloaded, node deleted) by now.
                const focused = graphHelper.focusedNode;
                if (focused && graphHelper.graph.hasNode(focused)) {
                    graphHelper.graph.setNodeAttribute(focused, "highlighted", false);
                }
                graphHelper.focusedNode = null;

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
                const edges = graphHelper.graph.edges(e.node);
                if (edges.length <= 10) edges.forEach(showEdgeLabel);
            },
            leaveNode: (e) => graphHelper.graph.edges(e.node).forEach(hideEdgeLabel),
            enterEdge: (e) => showEdgeLabel(e.edge),
            leaveEdge: (e) => hideEdgeLabel(e.edge),
        });
    }, [sigma, registerEvents]);

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
