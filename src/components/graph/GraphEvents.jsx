import { useMemo, useState } from "react";
import GraphContextMenu from "../menus/GraphContextMenu";
import EditAttributesModal from "../modals/EditAttributesModal";
import graphHelper from "../../graph-helper/GraphHelper";
import { NewNodeModal, NewEdgeModal } from "../modals/NewObjectModal";
import UpdateDeviceModal from "../modals/UpdateDeviceModal";
import UpdateRegulatorModal from "../modals/UpdateRegulatorModal";
import { getControlType } from "../modals/device-control";
import { useShortcut } from "../../hooks/useShortcut";
import { useExploreEvents } from "./explore-events";

const CLOSED_MENU = { open: false, x: 0, y: 0 };
const NO_CONTROL = { open: false, object: null, type: null };

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

    // Only state setters are closed over, so one handler set lives for the component's lifetime.
    const editHandlers = useMemo(() => {
        const openControl = (object, attributes, elementType) => {
            const type = getControlType(attributes, elementType);
            if (type) setControlContext({ open: true, object, type });
        };

        return {
            mousedown: () => setContext(CLOSED_MENU),
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
        };
    }, []);

    useExploreEvents(editHandlers);

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
