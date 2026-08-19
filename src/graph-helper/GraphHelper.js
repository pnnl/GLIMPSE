import { MultiUndirectedGraph } from "graphology";
import { emptyRoster, mergeRoster, normalizeRoster } from "./agents";
import { assignParallelEdgeCurvatures as assignCurvatures } from "./edge-curvature";
import { EdgeFocus } from "./edge-focus";
import { createEdge, createNode, hoverPayload } from "./element-factory";
import { buildGraph } from "./graph-builder";
import { HighlightState } from "./highlight-state";
import { legendEntries } from "./legend";
import {
    edgeLoadingSummary,
    edgeSeverity,
    edgeVitals,
    nodeSeverity,
    nodeVitals,
    nodeVoltageSummary,
    refreshNodeHover as rebuildNodeHover,
    violationCounts,
} from "./measurements";
import { applyCapacitorStates, applySimulationOutput, applySwitchStates } from "./simulation";
import * as socketApi from "./socket-api";
import {
    edgeTypesOf,
    emptyTypeCounts,
    flattenTheme,
    nodeTypesOf,
    resolveTheme,
    themeSourceFor,
} from "./theme";

const newGraph = () => new MultiUndirectedGraph({ allowSelfLoops: true, type: "undirected" });

class GraphHelper {
    // private
    #boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
    #theme = {};        // colors already flattened for the active mode
    #themeSource = null; // as authored, so a mode switch can re-flatten it
    #darkMode = false;
    #hasFixedNodes = false;
    #highlights = new HighlightState();
    #edgeFocus = new EdgeFocus();

    #ROTATE_ANGLE = Math.PI / 12; // 15 degrees in radians

    // Set whenever the user edits the model (attributes, new/deleted objects).
    // Edits live only in this graph — nothing is written back until Export — so
    // the UI uses this to warn before a load or a window close discards them.
    #dirty = false;

    // When on, the Sigma reducers recolor nodes by per-unit voltage and edges by
    // percent loading instead of by their theme group. See getNodeSeverity /
    // getEdgeSeverity and the reducers in GraphRenderer.
    #violationMode = false;

    // public
    sigmaInstance = null;
    nodeTypes = [];
    edgeTypes = [];
    isCIM = false;
    communitiesArray = [];
    communityColorPallet = {};
    themeName = "feeder-model-theme";
    selectedGridappsdModels = [];
    glmFileData = {};
    focusedNode = null;

    // Feeder mRID of the loaded GridAPPS-D model, used as the fallback when an
    // object carries no `feeder_id` of its own (device control needs one — see
    // resolveFeederIdFromGraph in ModelDataView). Only a GridAPPS-D load sets
    // it; clearGraphData() drops it, so a model from any other source can't
    // inherit the previous feeder.
    currentFeederID = null;

    distributionAreas = {}; // { "SwitchArea": [{ name, id }, ...], "SecondaryArea": [...] }
    hasGeoCoords = false; // true when node x/y hold real longitude/latitude (enables map background)

    // The GridAPPS-D distributed-agent roster for the loaded model. Agents are
    // keyed to distribution areas by mRID, so they ride on the same area ids the
    // graph already carries — see graph-helper/agents.js.
    agents = emptyRoster();

    // Ephemeral per-tick simulation measurements — voltage on bus nodes (PNV)
    // and power flow on edges (VA) — surfaced as a read-only overlay during a
    // run. Never written into a model's own `attributes`; cleared by reset()
    // when the simulation ends. Keyed by graph node/edge id:
    //   nodes: id -> { voltage: { <phase>: { magnitude, angle } } }
    //   edges: id -> { power:   { <phase>: { real, imag, magnitude, angle } } }
    liveMeasurements = { nodes: new Map(), edges: new Map() };

    constructor() {
        this.graph = newGraph();
        this.objectTypeCount = { nodes: {}, edges: {} };
    }

    setIsCIM = (value) => {
        this.isCIM = Boolean(value);
    };

    // ── Theme ───────────────────────────────────────────────────────────────

    setThemeObject = (jsonTheme = null) => {
        const theme = resolveTheme(this.themeName, jsonTheme, this.#darkMode);
        this.#themeSource = themeSourceFor(this.themeName, jsonTheme);

        if (!theme) {
            // The custom theme was selected but no theme file came with the
            // upload: there is nothing to derive types from, so the existing
            // type lists and counts are left as they are.
            this.#theme = { groups: {}, edgeOptions: {} };
            return;
        }

        this.#theme = theme;
        this.nodeTypes = nodeTypesOf(theme);
        this.edgeTypes = edgeTypesOf(theme);
        this.objectTypeCount = emptyTypeCounts(theme);
    };

    /** Guards the socket entry points, which can fire before any model is loaded. */
    #ensureTheme = () => {
        if (!this.#theme?.groups || !this.#theme?.edgeOptions) this.setThemeObject();
    };

    /**
     * Switches the theme between its light and dark colors.
     *
     * Theme colors are baked into node/edge attributes when the graph is built,
     * so re-flattening the theme is not enough on its own — every element that
     * still carries its themed color has to be repainted. Elements the renderer
     * is currently coloring by something other than type (violation mode, flow
     * animation) are left alone: those reducers re-derive their color each frame
     * anyway, and the reset path restores from the theme.
     *
     * @param {boolean} darkMode
     * @returns {boolean} whether anything changed
     */
    setDarkMode = (darkMode) => {
        const next = Boolean(darkMode);
        if (next === this.#darkMode) return false;
        this.#darkMode = next;

        if (!this.#themeSource) return false;

        // Types minted at load time for objects the theme didn't know about
        // (see ensureNodeGroup/ensureEdgeOption) only exist on the flattened
        // copy, so carry them across rather than losing them on every toggle.
        const reflowed = flattenTheme(this.#themeSource, next);
        for (const section of ["groups", "edgeOptions"]) {
            for (const [type, attrs] of Object.entries(this.#theme[section] ?? {})) {
                if (!(type in reflowed[section])) reflowed[section][type] = attrs;
            }
        }
        this.#theme = reflowed;

        this.graph.updateEachNodeAttributes((id, node) => {
            const themed = this.#theme.groups?.[node.group];
            if (!themed) return node;
            return {
                ...node,
                color: themed.color ?? node.color,
                borderColor: themed.borderColor ?? node.borderColor,
            };
        });

        this.graph.updateEachEdgeAttributes((id, edge) => {
            const themed = this.#theme.edgeOptions?.[edge.group];
            if (!themed) return edge;
            return { ...edge, color: themed.color ?? edge.color };
        });

        return true;
    };

    // ── Unsaved-edit tracking ───────────────────────────────────────────────
    // Model edits only exist in this graph until the user exports, so the app
    // warns before anything discards them (loading another model, closing the
    // window). The event lets the header show an indicator without polling.

    #setDirty = (value) => {
        if (this.#dirty === value) return;
        this.#dirty = value;
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("graph-dirty-change", { detail: { dirty: value } }));
        }
    };

    /** Call after any user edit to the model. */
    markDirty = () => this.#setDirty(true);

    /** Call once edits have been persisted (exported) or discarded. */
    clearDirty = () => this.#setDirty(false);

    hasUnsavedChanges = () => this.#dirty;

    // ── Violation highlighting ──────────────────────────────────────────────
    // Recolors the graph by electrical condition rather than by object type:
    // nodes by per-unit voltage against ANSI C84.1, edges by apparent power
    // against their normal rating. Both read the live simulation overlay, so
    // the mode is only meaningful while measurements are arriving.

    setViolationMode = (value) => {
        const next = Boolean(value);
        if (this.#violationMode === next) return;
        this.#violationMode = next;
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("graph-violation-mode-change", { detail: { enabled: next } }),
            );
        }
        this.sigmaInstance?.refresh();
    };

    toggleViolationMode = () => this.setViolationMode(!this.#violationMode);

    isViolationMode = () => this.#violationMode;

    // ── Live measurement reads (see measurements.js) ────────────────────────

    getNodeVoltageSummary = (nodeId) => nodeVoltageSummary(this.graph, this.liveMeasurements, nodeId);

    getEdgeLoadingSummary = (edgeId) => edgeLoadingSummary(this.graph, this.liveMeasurements, edgeId);

    getNodeSeverity = (nodeId) => nodeSeverity(this.graph, this.liveMeasurements, nodeId);

    getEdgeSeverity = (edgeId) => edgeSeverity(this.graph, this.liveMeasurements, edgeId);

    getViolationCounts = () => violationCounts(this.graph, this.liveMeasurements);

    buildNodeVitals = (nodeId) => nodeVitals(this.graph, this.liveMeasurements, nodeId);

    buildEdgeVitals = (edgeId) => edgeVitals(this.graph, this.liveMeasurements, edgeId);

    /** The hover-card fields drawHover reads; see element-factory.hoverPayload. */
    buildHoverPayload = (attributes, vitals = []) => hoverPayload(attributes, vitals);

    /** Recompute and store a live node's hover card in place. */
    refreshNodeHover = (nodeId) => rebuildNodeHover(this.graph, this.liveMeasurements, nodeId);

    // ── Highlighting (see highlight-state.js) ───────────────────────────────

    get highlightedNodeIDs() {
        return this.#highlights.nodeIDs;
    }

    get highlightedEdgeIDs() {
        return this.#highlights.edgeIDs;
    }

    get highlightedObjects() {
        return this.#highlights.objects;
    }

    get focusIndex() {
        return this.#highlights.focusIndex;
    }

    highlightGroup = (groupName) => this.#highlights.toggleGroup(this.graph, groupName);

    highlightEdgeTypes = (edgeType) => this.#highlights.toggleEdgeType(this.graph, edgeType);

    getHighlightedGroups = () => this.#highlights.groups;

    getHighlightedEdgeTypes = () => this.#highlights.edgeTypes;

    isHighlighted = (groupName) => this.#highlights.isHighlighted(groupName);

    setHighlightedAreas = (areaIds) => this.#highlights.setAreas(areaIds);

    getHighlightedAreas = () => this.#highlights.areas;

    isInHighlightedArea = (attrs) => this.#highlights.isInArea(attrs);

    getNext = () => this.#highlights.next();

    getPrevious = () => this.#highlights.previous();

    getCurrentHighlightedObject = () => this.#highlights.current();

    hideGroup = (type, group) => {
        const hide = (_id, attrs) => (attrs.group === group ? { ...attrs, hidden: true } : attrs);

        if (type === "node") this.graph.updateEachNodeAttributes(hide);
        else if (type === "edge") this.graph.updateEachEdgeAttributes(hide);
    };

    // ── Focus (see edge-focus.js) ───────────────────────────────────────────

    setFocusedEdge = (edgeId) => this.#edgeFocus.set(this.graph, edgeId);

    clearEdgeFocus = () => this.#edgeFocus.clear(this.graph);

    getFocusedEdgeId = () => this.#edgeFocus.edgeId;

    isFocusPulseActive = () => this.#edgeFocus.isPulseActive();

    getFocusedEdgeStyle = (edgeId, attrs) => this.#edgeFocus.styleFor(edgeId, attrs);

    /** Centers the camera on a highlighted object and marks it as the current focus. */
    focus = (obj) => {
        if (obj.type === "node") {
            this.clearEdgeFocus();
            this.graph.setNodeAttribute(obj.id, "highlighted", true);
            this.focusedNode = obj.id;

            const { x, y } = this.sigmaInstance.getNodeDisplayData(obj.id);
            this.sigmaInstance.getCamera().animate({ x, y, ratio: 0.05 }, { duration: 1000 });
        } else if (obj.type === "edge") {
            this.setFocusedEdge(obj.id);

            const { attributes } = this.graph.getEdgeAttributes(obj.id);
            const from = this.sigmaInstance.getNodeDisplayData(attributes.from);
            const to = this.sigmaInstance.getNodeDisplayData(attributes.to);

            this.sigmaInstance
                .getCamera()
                .animate(
                    { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, ratio: 0.05 },
                    { duration: 500 },
                );
        }

        this.sigmaInstance.refresh();
    };

    // ── Legend (see legend.js) ──────────────────────────────────────────────

    /** Flat legend data for the DOM legend panel. */
    getLegendData = () => legendEntries(this.#theme, this.objectTypeCount);

    resetObjectTypeCounts = () => {
        this.objectTypeCount = emptyTypeCounts(this.#theme);
    };

    // ── Layout ──────────────────────────────────────────────────────────────

    #rotate = (angle) => {
        this.graph.updateEachNodeAttributes((_node, attrs) => ({
            ...attrs,
            x: attrs.x * Math.cos(angle) - attrs.y * Math.sin(angle),
            y: attrs.x * Math.sin(angle) + attrs.y * Math.cos(angle),
        }));
    };

    rotateCCW = () => this.#rotate(this.#ROTATE_ANGLE);

    rotateCW = () => this.#rotate(-this.#ROTATE_ANGLE);

    assignParallelEdgeCurvatures = (graph = this.graph) => assignCurvatures(graph);

    // ── Simulation (see simulation.js) ──────────────────────────────────────

    handleSimulationOutput = (output) => {
        applySimulationOutput(
            { graph: this.graph, live: this.liveMeasurements, theme: this.#theme },
            output,
        );
        this.sigmaInstance?.refresh();
    };

    updateSwitches = (simOutput) => applySwitchStates(this.graph, simOutput);

    updateCapacitors = (simOutput) => applyCapacitorStates(this.graph, this.liveMeasurements, simOutput);

    // ── User edits ──────────────────────────────────────────────────────────

    /** Adds a node from the "new object" form, wired to an existing node. */
    newNodeWithEdge = (newNodeData) => {
        const { nodeType, nodeID, connectTo, edgeType } = newNodeData;

        if (this.graph.hasNode(nodeID)) {
            console.warn(`Node with ID ${nodeID} already exists.`);
            return;
        }

        const position = {
            x: (this.#boundsCoords.maxX + this.#boundsCoords.minX) / 2,
            y: (this.#boundsCoords.maxY + this.#boundsCoords.minY) / 2,
        };

        this.graph.addNode(
            nodeID,
            createNode({
                id: nodeID,
                objectType: nodeType,
                attributes: { id: nodeID, name: nodeID },
                theme: this.#theme,
                position,
            }),
        );

        this.newEdge({
            edgeType,
            edgeID: `${nodeID}-${connectTo}`,
            fromNode: nodeID,
            toNode: connectTo,
        });
    };

    /** Adds an edge from the "new object" form between two existing nodes. */
    newEdge = ({ edgeType, edgeID, fromNode, toNode }) => {
        this.graph.addEdgeWithKey(
            edgeID,
            fromNode,
            toNode,
            createEdge({
                objectType: edgeType,
                attributes: { from: fromNode, to: toNode, id: `${fromNode}-${toNode}` },
                theme: this.#theme,
            }),
        );

        this.markDirty();
    };

    // ── External socket API (see socket-api.js) ─────────────────────────────
    // The server validates and broadcasts these; every frontend applies them to
    // its own graph. Contract: socket-testing/EVENTS_API.md.

    /**
     * Loads a graph received over the socket "load-graph" event. `fileData` is the
     * normalized { name: { objects: [...] } } structure produced by the server for
     * both GLIMPSE-format and NetworkX node-link payloads. Mirrors the file-upload
     * flow so the rest of the app reacts the same way. The caller is responsible
     * for triggering a React re-render (e.g. via the GraphContext) afterwards.
     * @param {Object} fileData
     * @param {Object|null} themeData
     */
    loadGraphFromData = (fileData, themeData = null) => {
        if (this.graph.order > 0) {
            this.clearGraphData();
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("graph-cleared"));
        }

        this.isCIM = false;
        this.setThemeObject(themeData);
        this.setGraphData(fileData);

        if (typeof window !== "undefined")
            window.dispatchEvent(new CustomEvent("graph-loaded", { detail: { source: "socket" } }));
    };

    applyUpdate = (data) => {
        const applied = socketApi.applyUpdate(this.graph, data);
        if (applied) this.sigmaInstance?.refresh();
        return applied;
    };

    addNode = (obj) => {
        this.#ensureTheme();
        const added = socketApi.addNode(this.#socketContext(), obj);
        if (added) this.#afterTopologyChange();
        return added;
    };

    addEdge = (obj) => {
        this.#ensureTheme();
        const added = socketApi.addEdge(this.#socketContext(), obj);
        if (added) {
            this.assignParallelEdgeCurvatures();
            this.#afterTopologyChange();
        }
        return added;
    };

    deleteNode = (nodeID) => {
        const removed = socketApi.deleteNode(this.#socketContext(), nodeID);
        if (removed) this.#afterTopologyChange();
        return removed;
    };

    deleteEdge = (edgeID) => {
        const removed = socketApi.deleteEdge(this.#socketContext(), edgeID);
        if (removed) this.#afterTopologyChange();
        return removed;
    };

    #socketContext = () => ({
        graph: this.graph,
        theme: this.#theme,
        nodeTypes: this.nodeTypes,
        edgeTypes: this.edgeTypes,
        objectTypeCount: this.objectTypeCount,
        bounds: this.#boundsCoords,
    });

    #afterTopologyChange = () => {
        this.sigmaInstance?.refresh();
    };

    // ── Lifecycle ───────────────────────────────────────────────────────────

    /** Undoes every view-level change: highlights, hiding, and the sim overlay. */
    reset = () => {
        // Drop the live-simulation overlay and restore each node's base hover
        // card (the vitals block added during the run is removed here).
        const measuredNodes = [...this.liveMeasurements.nodes.keys()];
        this.liveMeasurements.nodes.clear();
        this.liveMeasurements.edges.clear();
        for (const nodeId of measuredNodes) {
            // Cleared first, so this rebuilds with empty vitals.
            this.refreshNodeHover(nodeId);
        }

        // Condition coloring is meaningless without measurements.
        this.setViolationMode(false);

        this.#highlights.clear();
        this.clearEdgeFocus();

        // show any hidden edges and nodes. An edge whose group isn't in the
        // theme (added over the socket API, or from an unrecognized objectType)
        // keeps the color/size it already has rather than throwing and leaving
        // the rest of the reset half-applied.
        this.graph.updateEachEdgeAttributes((id, edge) => {
            const themed = this.#theme.edgeOptions?.[edge.group];
            return {
                ...edge,
                type: edge.type === "animated" ? "straight" : edge.type,
                hidden: false,
                zIndex: 0,
                color: themed?.color ?? edge.color,
                size: themed?.size ?? edge.size,
            };
        });

        this.graph.updateEachNodeAttributes((id, node) => ({
            ...node,
            hidden: false,
            highlighted: false,
        }));

        // Let UI (e.g. the legend panel) clear any per-type highlight/hide state it
        // mirrors locally, since we just cleared it on the graph.
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("graph-reset"));
    };

    /** Throws the model away. Callers confirm with the user first — see confirmDiscardChanges. */
    clearGraphData = () => {
        this.resetObjectTypeCounts();
        this.isCIM = false;
        // Whatever was edited is being discarded here.
        this.clearDirty();

        // The live overlay belongs to the model being replaced. Without this it
        // survived into the next model, where stale mRID collisions could show
        // voltages and loading for objects that were never measured.
        this.liveMeasurements.nodes.clear();
        this.liveMeasurements.edges.clear();
        this.setViolationMode(false);

        this.#highlights.clear();

        this.graph = newGraph();

        this.sigmaInstance = null;
        this.#hasFixedNodes = false;
        this.hasGeoCoords = false;
        this.#boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
        this.communitiesArray = [];
        this.communityColorPallet = {};
        this.distributionAreas = {};
        this.agents = emptyRoster();
        this.currentFeederID = null;
    };

    /** Replaces the agent roster wholesale — the response from /api/gridappsd/agents. */
    setAgentData = (payload) => {
        this.agents = normalizeRoster(payload);
    };

    /**
     * Folds an `agents-update` broadcast into the roster. A status-only payload
     * updates liveness in place rather than replacing the roster, so a ping from
     * an external script can't blank out the areas and devices the REST load
     * established.
     */
    applyAgentUpdate = (payload) => {
        this.agents = mergeRoster(this.agents, payload);
    };

    /**
     * Builds the graph for a parsed model. The heavy lifting is in
     * graph-builder.js — the type lists, counts and bounds it fills in are this
     * object's state, passed in and mutated in place.
     */
    setGraphData = (fileData) => {
        // save glm file data for exporting changes
        if (!this.isCIM) this.glmFileData = fileData;

        const { graph, hasFixedNodes, hasGeoCoords, distributionAreas } = buildGraph(fileData, {
            theme: this.#theme,
            nodeTypes: this.nodeTypes,
            edgeTypes: this.edgeTypes,
            objectTypeCount: this.objectTypeCount,
            bounds: this.#boundsCoords,
            hasFixedNodes: this.#hasFixedNodes,
        });

        this.graph = graph;
        this.#hasFixedNodes = hasFixedNodes;
        this.hasGeoCoords = hasGeoCoords;
        this.distributionAreas = distributionAreas;

        // A freshly loaded model matches its source file — nothing to save yet.
        this.clearDirty();
    };

    /** The parsed model, with every edited attribute written back onto it. */
    export = () => {
        const edgeIDs = this.graph.edges();
        const nodeIDs = this.graph.nodes();

        Object.keys(this.glmFileData).forEach((file) => {
            this.glmFileData[file].objects.forEach((obj) => {
                if (!("attributes" in obj)) return;

                if (nodeIDs.includes(obj.attributes.name)) {
                    obj.attributes = this.graph.getNodeAttributes(obj.attributes.name).attributes;
                }

                if (edgeIDs.includes(obj.attributes.name)) {
                    obj.attributes = this.graph.getEdgeAttributes(obj.attributes.name).attributes;
                }
            });
        });

        return this.glmFileData;
    };
}

const graphHelper = new GraphHelper();

export default graphHelper;
