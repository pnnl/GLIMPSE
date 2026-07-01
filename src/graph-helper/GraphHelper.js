import { MultiUndirectedGraph, MultiGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";
import iwanthue from "iwanthue";
import circlepack from "graphology-layout/circlepack";
import POWER_GRID_THEME from "../themes/PowerGrid.theme.json";
import { getFA2Settings } from "../utils/fa2-presets";
import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";

class GraphHelper {
    // private
    #boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
    #theme = {};
    #highlightedGroups = [];
    #highlightedEdgeTypes = [];
    #highlightedAreas = []; // selected distribution-area ids (any level)
    #hasFixedNodes = false;

    #ROTATE_ANGLE = Math.PI / 12; // 15 degrees in radians

    // public
    sigmaInstance = null;
    highlightedNodeIDs = []; // contain the IDs of highlighted nodes
    highlightedEdgeIDs = []; // contains the IDs of highlighted edges
    highlightedObjects = [];
    focusIndex = -1;
    nodeTypes = [];
    edgeTypes = [];
    isCIM = false;
    communitiesArray = [];
    communityColorPallet = {};
    themeName = "feeder-model-theme";
    selectedGridappsdModels = [];
    glmFileData = {};
    focusedNode = null;
    distributionAreas = {}; // { "SwitchArea": [{ name, id }, ...], "SecondaryArea": [...] }

    constructor() {
        this.legendGraph = new MultiGraph();
        this.graph = new MultiUndirectedGraph({
            allowSelfLoops: true,
            type: "undirected",
        });
        this.nodeTypes = [];
        this.edgeTypes = [];
        this.objectTypeCount = {
            nodes: {},
            edges: {},
        };
    }

    setThemeObject = (jsonTheme = null) => {
        if (this.themeName === "custom-theme") {
            if (jsonTheme) {
                this.#theme = jsonTheme;
                this.nodeTypes = Object.keys(this.#theme.groups);
                this.edgeTypes = Object.keys(this.#theme.edgeOptions);
                this.objectTypeCount = {
                    nodes: Object.keys(this.#theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
                    edges: Object.keys(this.#theme.edgeOptions).reduce(
                        (o, key) => ({ ...o, [key]: 0 }),
                        {},
                    ),
                };
            } else {
                this.#theme = {
                    groups: {},
                    edgeOptions: {},
                };
            }

            return;
        }

        // if the custom-theme was not selected then default to power grid theme
        this.#theme = POWER_GRID_THEME;
        this.nodeTypes = Object.keys(this.#theme.groups);
        this.edgeTypes = Object.keys(this.#theme.edgeOptions);
        this.objectTypeCount = {
            nodes: Object.keys(this.#theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
            edges: Object.keys(this.#theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
        };

        console.log(this.#theme);
    };

    /**
     * Generates a random color in hexadecimal format.
     * @returns A hexadecimal color
     */
    getRandomColor = () => {
        const letters = "0123456789ABCDEF";
        let color = "#";

        while (color.length < 7) color += letters[Math.floor(Math.random() * 16)];

        return color;
    };

    hideGroup = (type, group) => {
        if (type === "node") {
            this.graph.updateEachNodeAttributes((node, attrs) => {
                if (attrs.group === group) {
                    return {
                        ...attrs,
                        hidden: true,
                    };
                }

                return attrs;
            });
        } else if (type === "edge") {
            this.graph.updateEachEdgeAttributes((edge, attrs) => {
                if (attrs.group === group) {
                    return {
                        ...attrs,
                        hidden: true,
                    };
                }

                return attrs;
            });
        }
    };

    highlightEdgeTypes = (edgeType) => {
        if (this.#highlightedEdgeTypes.includes(edgeType)) {
            this.#highlightedEdgeTypes = this.#highlightedEdgeTypes.filter(
                (hEdgeType) => hEdgeType !== edgeType,
            );
        } else {
            this.#highlightedEdgeTypes.push(edgeType);
        }

        this.highlightedEdgeIDs = this.graph
            .filterEdges((e, attrs) => this.#highlightedEdgeTypes.includes(attrs.group))
            .map((e) => ({ type: "edge", id: e }));

        this.highlightedObjects = [...this.highlightedNodeIDs, ...this.highlightedEdgeIDs];
    };

    // Toggle highlight state of a group
    highlightGroup = (groupName) => {
        if (this.#highlightedGroups.includes(groupName)) {
            this.#highlightedGroups = this.#highlightedGroups.filter((hGroup) => hGroup !== groupName);
        } else {
            this.#highlightedGroups.push(groupName);
        }

        this.highlightedNodeIDs = this.graph
            .filterNodes((n, attrs) => this.#highlightedGroups.includes(attrs.group))
            .map((n) => ({ type: "node", id: n }));
        this.highlightedObjects = [...this.highlightedNodeIDs, ...this.highlightedEdgeIDs];
    };

    getHighlightedEdgeTypes = () => {
        return this.#highlightedEdgeTypes;
    };

    getHighlightedGroups = () => {
        return this.#highlightedGroups;
    };

    isHighlighted = (groupName) => {
        return (
            this.#highlightedGroups.includes(groupName) || this.#highlightedEdgeTypes.includes(groupName)
        );
    };

    // Flat legend data for the DOM legend panel: only types actually present in the
    // model (count > 0), each with its themed color so the panel can render swatches
    // without reaching into the private theme.
    getLegendData = () => {
        const nodes = Object.entries(this.objectTypeCount.nodes)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => ({
                type,
                count,
                color: this.#theme.groups?.[type]?.color ?? "#888888",
                borderColor: this.#theme.groups?.[type]?.borderColor ?? "#00000033",
            }));

        const edges = Object.entries(this.objectTypeCount.edges)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => ({
                type,
                count,
                color: this.#theme.edgeOptions?.[type]?.color ?? "#888888",
            }));

        return { nodes, edges };
    };

    // Distribution-area highlighting. Selected ids may be at any level
    // (feeder / switch / secondary); a node or edge is "in" the selection if any
    // of its area ids match. Because a member carries its full ancestry, selecting
    // a switch area also matches the nodes/edges in that switch area's secondary
    // areas, and selecting a feeder area matches everything under it.
    setHighlightedAreas = (areaIds) => {
        this.#highlightedAreas = Array.isArray(areaIds) ? areaIds : [];
    };

    getHighlightedAreas = () => {
        return this.#highlightedAreas;
    };

    isInHighlightedArea = (attrs) => {
        if (this.#highlightedAreas.length === 0) return true;
        const a = (attrs && attrs.attributes) || {};
        return (
            this.#highlightedAreas.includes(a.feeder_area_id) ||
            this.#highlightedAreas.includes(a.switch_area_id) ||
            this.#highlightedAreas.includes(a.secondary_area_id)
        );
    };

    reset = () => {
        this.#highlightedEdgeTypes.length = 0;
        this.#highlightedGroups.length = 0;
        this.#highlightedAreas.length = 0;
        this.highlightedNodeIDs.length = 0;
        this.highlightedEdgeIDs.length = 0;
        this.highlightedObjects.length = 0;
        this.focusIndex = -1;

        // show any hidden edges and nodes
        this.graph.updateEachEdgeAttributes((id, edge) => ({
            ...edge,
            size: this.#theme.edgeOptions[edge.group].size,
            type: edge.type === "animated" ? "straight" : edge.type,
            hidden: false,
            color: this.#theme.edgeOptions[edge.group].color,
            size: this.#theme.edgeOptions[edge.group].size,
        }));

        this.graph.updateEachNodeAttributes((id, node) => ({
            ...node,
            hidden: false,
        }));

        // Let UI (e.g. the legend panel) clear any per-type highlight/hide state it
        // mirrors locally, since we just cleared it on the graph.
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("graph-reset"));
    };

    clearGraphData = () => {
        this.resetObjectTypeCounts();
        this.isCIM = false;

        // Clear highlighted arrays and state
        this.#highlightedEdgeTypes.length = 0;
        this.#highlightedGroups.length = 0;
        this.#highlightedAreas.length = 0;
        this.highlightedNodeIDs.length = 0;
        this.highlightedEdgeIDs.length = 0;
        this.highlightedObjects.length = 0;
        this.focusIndex = -1;

        this.graph = new MultiUndirectedGraph({
            allowSelfLoops: true,
            type: "undirected",
        });
        this.legendGraph.clear();

        this.sigmaInstance = null;
        this.#hasFixedNodes = false;
        this.#boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
        this.communitiesArray = [];
        this.communityColorPallet = {};
        this.distributionAreas = {};
    };

    getNext = () => {
        this.focusIndex++;

        if (this.focusIndex === this.highlightedObjects.length) {
            this.focusIndex = 0;
        }

        return this.highlightedObjects[this.focusIndex];
    };

    getPrevious = () => {
        this.focusIndex--;

        if (this.focusIndex < 0) {
            this.focusIndex = this.highlightedObjects.length - 1;
        }

        return this.highlightedObjects[this.focusIndex];
    };

    getCurrentHighlightedObject = () => {
        if (this.focusIndex === -1 || this.highlightedObjects.length === 0) return null;
        return this.highlightedObjects[this.focusIndex];
    };

    focus = (obj) => {
        console.log("Focusing on: " + obj.id);

        if (obj.type === "node") {
            this.graph.setNodeAttribute(obj.id, "highlighted", true);
            this.focusedNode = obj.id;

            const { x, y } = this.sigmaInstance.getNodeDisplayData(obj.id);
            this.sigmaInstance.getCamera().animate({ x: x, y: y, ratio: 0.05 }, { duration: 1000 });
        } else if (obj.type === "edge") {
            this.graph.setEdgeAttribute(obj.id, "label", obj.id);
            const { attributes } = this.graph.getEdgeAttributes(obj.id);
            const fromNode = this.sigmaInstance.getNodeDisplayData(attributes.from);
            const toNode = this.sigmaInstance.getNodeDisplayData(attributes.to);

            const x_1 = fromNode.x;
            const y_1 = fromNode.y;
            const x_2 = toNode.x;
            const y_2 = toNode.y;

            const midPoint = { x: (x_1 + x_2) / 2, y: (y_1 + y_2) / 2 };

            this.sigmaInstance.getCamera().animate(
                {
                    x: midPoint.x,
                    y: midPoint.y,
                    ratio: 0.05,
                },
                { duration: 500 },
            );
        }

        this.sigmaInstance.refresh();
    };

    /**
     * Converts an object of attributes from a node or edge to a string to be displayed
     * @param {Object} attributes - an object
     * @returns {string}
     */
    getTitle = (attributes) => {
        const title = [];

        for (let [key, val] of Object.entries(attributes)) {
            // The dist_areas list of nested areas is rendered one area per line
            // (type: name) so the tooltip card stays narrow instead of one wide
            // JSON line.
            if (key === "dist_areas" && Array.isArray(val)) {
                title.push(`${key}:`);
                for (const area of val) {
                    title.push(`  ${area.dist_area_type}: ${area.dist_area_name || area.dist_area_id}`);
                }
                continue;
            }

            // Any other nested array/object would otherwise render as
            // "[object Object]"; serialize it so the tooltip stays readable.
            const display = val !== null && typeof val === "object" ? JSON.stringify(val) : val;
            title.push(`${key}: ${display}`);
        }

        return title.join("\n");
    };

    setLegendData = () => {
        this.legendGraph.clear();
        const currentNodeTypes = [];
        const currentEdgeTypes = [];

        Object.entries(this.objectTypeCount.nodes).forEach(([type, count]) => {
            if (count > 0) currentNodeTypes.push(type);
        });

        Object.entries(this.objectTypeCount.edges).forEach(([type, count]) => {
            if (count > 0) currentEdgeTypes.push(type);
        });

        let x_increment = null;
        if (currentNodeTypes.length === 5) x_increment = 800 / 5;
        else if (currentNodeTypes.length === 2) x_increment = 400;
        else x_increment = 900 / 6;

        let farthest_x = 0;
        let current_x = 0;
        let current_y = 0;
        let rowNodeCount = 0;

        for (let nodeType of currentNodeTypes) {
            if (this.legendGraph.nodes().length === 0) {
                if (nodeType in this.#theme.groups) {
                    this.legendGraph.addNode(nodeType, {
                        label: `${nodeType}\n[${this.objectTypeCount.nodes[nodeType]}]`,
                        forceLabel: true,
                        ...this.#theme.groups[nodeType],
                        size: 15,
                        group: nodeType,
                        title: "Double Click to Highlight !",
                        x: current_x,
                        y: current_y,
                        fixed: true,
                    });
                    rowNodeCount++;
                    continue;
                }

                this.legendGraph.addNode(nodeType, {
                    label: `${nodeType}\n[${this.objectTypeCount.nodes[nodeType]}]`,
                    forceLabel: true,
                    ...this.#theme.groups[nodeType],
                    size: 15,
                    groups: nodeType,
                    title: "Double Click to Highlight !",
                    x: current_x,
                    y: current_y,
                    fixed: true,
                });
                rowNodeCount++;
                continue;
            }

            if (rowNodeCount === 6) {
                farthest_x = current_x;
                rowNodeCount = 0;
                current_x = 0;
                current_y -= 200;
            } else {
                current_x += x_increment;
            }

            if (nodeType in this.#theme.groups) {
                this.legendGraph.addNode(nodeType, {
                    label: `${nodeType}\n[${this.objectTypeCount.nodes[nodeType]}]`,
                    forceLabel: true,
                    ...this.#theme.groups[nodeType],
                    size: 15,
                    group: nodeType,
                    title: "Double Click to Highlight !",
                    x: current_x,
                    y: current_y,
                    fixed: true,
                });

                rowNodeCount++;
                continue;
            }

            this.legendGraph.addNode(nodeType, {
                label: `${nodeType}\n[${this.objectTypeCount.nodes[nodeType]}]`,
                forceLabel: true,
                ...this.#theme.groups[nodeType],
                size: 15,
                group: nodeType,
                title: "Double Click to Highlight !",
                x: current_x,
                y: current_y,
                fixed: true,
            });
            rowNodeCount++;
        }

        current_y = 100;
        currentEdgeTypes.forEach((type, index) => {
            let nodeIDFrom = `${type}:${index}`;
            let nodeIDTo = `${type}:${index + 1}`;

            this.legendGraph.addNode(nodeIDFrom, {
                id: nodeIDFrom,
                x: current_x === farthest_x ? -250 : 0,
                y: current_y,
                size: 6,
                fixed: true,
                color: "#000000",
                borderColor: "#000000",
            });

            this.legendGraph.addNode(nodeIDTo, {
                id: nodeIDTo,
                size: 6,
                x: farthest_x === current_x ? 250 : farthest_x === 0 ? current_x : farthest_x,
                y: current_y,
                fixed: true,
                color: "#000000",
                borderColor: "#000000",
            });

            if (type in this.#theme.edgeOptions) {
                this.legendGraph.addEdgeWithKey(type, nodeIDFrom, nodeIDTo, {
                    id: type,
                    from: nodeIDFrom,
                    to: nodeIDTo,
                    type:
                        type === "switch"
                            ? "switch"
                            : type === "regulator"
                              ? "regulator"
                              : type === "transformer"
                                ? "transformer"
                                : "straight",
                    title: "Double Click to Highlight !",
                    label: `${type} [${this.objectTypeCount.edges[type]}]`,
                    forceLabel: true,
                    size: 8,
                    switchSize: 16,
                    switchColor: "#FF0000",
                    regulatorSize: 50,
                    regulatorColor: this.#theme.edgeOptions[type].color,
                    transformerSize: 50,
                    transformerColor: this.#theme.edgeOptions[type].color,
                    color: this.#theme.edgeOptions[type].color,
                });
            } else {
                this.legendGraph.addEdgeWithKey(type, nodeIDFrom, nodeIDTo, {
                    id: type,
                    from: nodeIDFrom,
                    to: nodeIDTo,
                    type: "straight",
                    forceLabel: true,
                    label: `${type} [${this.objectTypeCount.edges[type]}]`,
                    title: "Double Click to Highlight !",
                    size: 8,
                });
            }

            current_y += 65;
        });
    };

    resetObjectTypeCounts = () => {
        this.objectTypeCount = {
            nodes: Object.keys(this.#theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
            edges: Object.keys(this.#theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
        };
    };

    rotateCCW = () => {
        this.graph.forEachNode((node, attrs) => {
            const newX = attrs.x * Math.cos(this.#ROTATE_ANGLE) - attrs.y * Math.sin(this.#ROTATE_ANGLE);
            const newY = attrs.x * Math.sin(this.#ROTATE_ANGLE) + attrs.y * Math.cos(this.#ROTATE_ANGLE);

            this.graph.setNodeAttribute(node, "x", newX);
            this.graph.setNodeAttribute(node, "y", newY);
        });
    };

    rotateCW = () => {
        this.graph.forEachNode((node, attrs) => {
            const newX =
                attrs.x * Math.cos(-this.#ROTATE_ANGLE) - attrs.y * Math.sin(-this.#ROTATE_ANGLE);
            const newY =
                attrs.x * Math.sin(-this.#ROTATE_ANGLE) + attrs.y * Math.cos(-this.#ROTATE_ANGLE);

            this.graph.setNodeAttribute(node, "x", newX);
            this.graph.setNodeAttribute(node, "y", newY);
        });
    };

    #getCurvature(index, maxIndex) {
        if (maxIndex <= 0) throw new Error("Invalid maxIndex");
        if (index < 0) return -this.#getCurvature(-index, maxIndex);

        const amplitude = 3.5;
        const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE;

        return (maxCurvature * index) / maxIndex;
    }

    /**
     * Runs a synchronous ForceAtlas2 pass on a freshly-built graph so it renders
     * already unraveled. Iteration count scales down as the graph grows so the
     * blocking pass stays responsive on large models.
     * @param {MultiUndirectedGraph} graph
     */
    #preWarmLayout(graph) {
        const order = graph.order;

        // More nodes → fewer iterations to keep the synchronous pass snappy.
        // ~600 iters for small graphs, tapering to a floor of ~80 for huge ones.
        let iterations;
        if (order <= 1_000) iterations = 300;
        else if (order <= 5_000) iterations = 200;
        else if (order <= 20_000) iterations = 120;
        else iterations = 80;

        try {
            forceAtlas2.assign(graph, {
                iterations,
                settings: getFA2Settings(graph),
            });
        } catch (err) {
            // Layout is a best-effort enhancement; never block graph loading on it.
            console.warn("FA2 pre-warm failed, falling back to initial placement:", err);
        }
    }

    assignParallelEdgeCurvatures = (graph) => {
        // Step 1: let the library detect which edges are parallel
        indexParallelEdgesIndex(graph, {
            edgeIndexAttribute: "parallelIndex",
            edgeMinIndexAttribute: "parallelMinIndex",
            edgeMaxIndexAttribute: "parallelMaxIndex",
        });

        // Icon edges (switch / regulator / transformer) keep their custom symbol
        // when fanned out: map to a curved-line variant instead of plain "curved"
        // so the icon program still runs and draws the symbol on the curve.
        const curvedIconType = {
            switch: "curvedSwitch",
            regulator: "curvedRegulator",
            transformer: "curvedTransformer",
        };
        const curvedType = (iconType) => (iconType ? curvedIconType[iconType] : "curved");
        // Tiny curvature for the otherwise-straight primary of an icon fan: keeps
        // the whole fan in ONE curved edge type (so every icon is drawn after every
        // line, i.e. on top) while staying visually straight. The curve program
        // can't render an exactly-zero curvature, so this can't be 0.
        const ICON_PRIMARY_CURVATURE = 0.012;

        // Step 2: assign type + curvature based on the indexed values
        graph.forEachEdge((edge, { parallelIndex, parallelMinIndex, parallelMaxIndex, iconType }) => {
            if (typeof parallelMinIndex === "number") {
                // ── Undirected parallel group ──
                // The edge at index 0 normally stays straight (the "primary" edge);
                // all others curve so they fan out on either side.
                const curvature = this.#getCurvature(parallelIndex, parallelMaxIndex);

                if (iconType) {
                    // Keep every member of an icon fan in the same curved type so the
                    // icons always render on top of all the fan's lines.
                    graph.mergeEdgeAttributes(edge, {
                        type: curvedType(iconType),
                        curvature: parallelIndex ? curvature : ICON_PRIMARY_CURVATURE,
                    });
                } else {
                    graph.mergeEdgeAttributes(edge, {
                        type: parallelIndex ? "curved" : "straight",
                        curvature,
                    });
                }

                return;
            }

            if (typeof parallelIndex === "number") {
                // ── Directed parallel group (shouldn't happen in our undirected
                //    graph, but included for completeness) ──
                graph.mergeEdgeAttributes(edge, {
                    type: curvedType(iconType),
                    curvature: this.#getCurvature(parallelIndex, parallelMaxIndex),
                });
            }
        });
    };

    updateSwitches = (simOutput) => {
        const { timestamp, switches } = simOutput;

        switches.forEach((sw) => {
            const { equipment_mrid: switchID, open, value } = sw;

            if (!this.graph.hasEdge(switchID)) {
                console.warn(`Switch with ID ${switchID} not found in the graph.`);
                return;
            }

            this.graph.updateEdgeAttributes(switchID, (attrs) => {
                const newEdge = {
                    ...attrs,
                    switchColor: value === 0 ? "#4aff4a" : "#ff0000",
                    attributes: {
                        ...attrs.attributes,
                        status: value === 0 ? "OPEN" : "CLOSED",
                    },
                };

                return newEdge;
            });
        });
    };

    updateCapacitors = (simOutput) => {
        const { timestamp, capacitors } = simOutput;

        capacitors.forEach((cap) => {
            const { equipment_mrid: capID, value } = cap;

            if (!this.graph.hasNode(capID)) {
                console.warn(`Capacitor with ID ${capID} not found in the graph.`);
                return;
            }

            this.graph.updateNodeAttributes(capID, (attrs) => {
                console.log(
                    `Updating capacitor ${attrs.attributes.name} with value ${value} at timestamp ${timestamp}`,
                );

                const newNode = {
                    ...attrs,
                    attributes: {
                        ...attrs.attributes,
                        sections: value,
                    },
                };

                newNode["attributesLabel"] = this.getTitle(newNode.attributes);
                return newNode;
            });
        });
    };

    handleSimulationOutput = (output) => {
        const { timestamp, Analog, Discrete } = output;

        // Real part of the complex power below this (in VA) is treated as zero so
        // we don't pick a flow direction off of numerical noise.
        const FLOW_THRESHOLD = 1e-6;

        // On a one-line diagram a single edge carries several VA measurements
        // (one per phase). The true power flow is the complex sum of all of them,
        // so aggregate by edge before deciding direction. magnitude/angle describe
        // the polar form of each complex VA measurement (angle is in degrees).
        const edgePowerSums = new Map(); // equipment_mrid -> { real, imag, normalLimit }

        for (let measurement of Analog) {
            // Only VA (power) measurements determine flow; skip PNV/Pos/etc.
            if (measurement.measurement_type !== "VA") continue;

            if (
                !this.graph.hasEdge(measurement.equipment_mrid) ||
                this.graph.hasNode(measurement.equipment_mrid)
            ) {
                continue;
            }

            const angleRad = (measurement.angle * Math.PI) / 180;
            const sum = edgePowerSums.get(measurement.equipment_mrid) || {
                real: 0,
                imag: 0,
                normalLimit: measurement.normal_limit?.Normal,
            };
            sum.real += measurement.magnitude * Math.cos(angleRad);
            sum.imag += measurement.magnitude * Math.sin(angleRad);
            if (sum.normalLimit == null && measurement.normal_limit) {
                sum.normalLimit = measurement.normal_limit.Normal;
            }
            edgePowerSums.set(measurement.equipment_mrid, sum);
        }

        for (const [edgeID, sum] of edgePowerSums) {
            this.graph.updateEdgeAttributes(edgeID, (edgeAttrs) => {
                // Don't animate icon edges (switch/regulator/transformer, straight
                // or curved) — that would replace their custom symbol program.
                if (edgeAttrs.iconType) {
                    return edgeAttrs;
                }

                // Direction follows the sign of the real part of the summed power;
                // when the real part is ~0 fall back to the imaginary part. Same
                // sign->direction mapping for either: positive = from->to (forward).
                let flowDirection;
                if (Math.abs(sum.real) >= FLOW_THRESHOLD) {
                    flowDirection = sum.real > 0 ? 1 : -1;
                } else if (Math.abs(sum.imag) >= FLOW_THRESHOLD) {
                    flowDirection = sum.imag > 0 ? 1 : -1;
                } else {
                    flowDirection = 0; // both parts within the threshold -> no flow
                }

                const prevFlowDirection = edgeAttrs.flowDirection;
                const edgeName = edgeAttrs.attributes?.name ?? edgeID;
                console.log(
                    `[flow] ${edgeName}: VA sum real=${sum.real.toExponential(3)} ` +
                        `imag=${sum.imag.toExponential(3)} -> flowDirection ${prevFlowDirection} => ${flowDirection}` +
                        (prevFlowDirection !== flowDirection ? " (CHANGED)" : " (unchanged)"),
                );

                if (flowDirection === 0) {
                    edgeAttrs.color = "rgba(145, 145, 145, 0.7)";
                    edgeAttrs.type = "straight";
                    edgeAttrs.flowDirection = flowDirection;
                    return edgeAttrs;
                }

                edgeAttrs.type = "animated";
                edgeAttrs.flowDirection = flowDirection;
                // Restore the edge's theme color in case it was greyed out while
                // it had no flow on a previous tick.
                edgeAttrs.color = this.#theme.edgeOptions[edgeAttrs.group]?.color ?? edgeAttrs.color;

                if (sum.normalLimit) {
                    const powerFlow = Math.hypot(sum.real, sum.imag) / sum.normalLimit;
                    edgeAttrs.size = Math.max(0.15, Math.log(powerFlow + 1) * 0.5);
                    // Dots travel faster the more power the line carries. dotSpeed is
                    // in cycles/sec; clamp to a band so low flow still creeps and
                    // high flow doesn't blur into a solid line.
                    const DOT_SPEED_MIN = 0.1;
                    const DOT_SPEED_MAX = 1.0;
                    edgeAttrs.dotSpeed = Math.min(
                        DOT_SPEED_MAX,
                        Math.max(DOT_SPEED_MIN, Math.log(powerFlow + 1) * 0.6),
                    );
                }

                return edgeAttrs;
            });
        }

        for (let measurement of Discrete) {
            if (
                !this.graph.hasNode(measurement.equipment_mrid) &&
                this.graph.hasEdge(measurement.equipment_mrid)
            ) {
                this.graph.updateEdgeAttributes(measurement.equipment_mrid, (edge) => {
                    if (edge.group === "switch") {
                        edge.switchColor = measurement.value === 0 ? "#4aff4a" : "#ff0000";
                        edge.attributes.status = measurement.value === 0 ? "OPEN" : "CLOSED";
                    }

                    return edge;
                });
            } else if (
                !this.graph.hasEdge(measurement.equipment_mrid) &&
                this.graph.hasNode(measurement.equipment_mrid)
            ) {
                this.graph.updateNodeAttributes(measurement.equipment_mrid, (node) => {
                    if (node.group === "capacitor") {
                        node.attributes.sections = measurement.value;
                        node["attributesLabel"] = this.getTitle(node.attributes);
                    }

                    return node;
                });
            }
        }
    };

    newNodeWithEdge = (newNodeData) => {
        const { nodeType, nodeID, connectTo, edgeType } = newNodeData;

        if (this.graph.hasNode(nodeID)) {
            console.warn(`Node with ID ${nodeID} already exists.`);
            return;
        }

        const midPoint = {
            x: (this.#boundsCoords.maxX + this.#boundsCoords.minX) / 2,
            y: (this.#boundsCoords.maxY + this.#boundsCoords.minY) / 2,
        };

        const newNode = {
            label: nodeID,
            elementType: "node",
            group: nodeType,
            x: midPoint.x,
            y: midPoint.y,
            fixed: false,
            attributes: { id: nodeID, name: nodeID },
            ...this.#theme.groups[nodeType],
        };

        const newEdge = {
            elementType: "edge",
            group: edgeType,
            type: "straight",
            dotColor: "#ff0000",
            dotSize: 6,
            dotSpeed: 0.25,
            dotPhase: Math.random(),
            flowDirection: 1, // -1 for opposite flow
            dotCount: 1,
            attributes: { from: nodeID, to: connectTo, id: `${nodeID}-${connectTo}` },
            ...this.#theme.edgeOptions[edgeType],
        };

        // color witch edges red if they are open
        if (edgeType === "switch") {
            newEdge.switchColor = "#ff0000";
            newEdge.type = "switch";
            newEdge.iconType = "switch";
            newEdge.switchSize = 8;
        }

        // draw an IEEE regulator symbol in the middle of regulator edges
        if (edgeType === "regulator") {
            newEdge.type = "regulator";
            newEdge.iconType = "regulator";
            newEdge.regulatorSize = 16;
        }

        // draw an IEEE transformer symbol in the middle of transformer edges
        if (edgeType === "transformer") {
            newEdge.type = "transformer";
            newEdge.iconType = "transformer";
            newEdge.transformerSize = 16;
        }

        this.graph.addNode(nodeID, newNode);
        this.graph.addEdgeWithKey(`${nodeID}-${connectTo}`, nodeID, connectTo, newEdge);
    };

    newEdge = (newEdgeData) => {
        const { edgeType, edgeID, fromNode, toNode } = newEdgeData;

        const newEdge = {
            elementType: "edge",
            group: edgeType,
            type: "straight",
            dotColor: "#ff0000",
            dotSize: 6,
            dotSpeed: 0.25,
            dotPhase: Math.random(),
            flowDirection: 1, // -1 for opposite flow
            dotCount: 1,
            attributes: { from: fromNode, to: toNode, id: `${fromNode}-${toNode}` },
            ...this.#theme.edgeOptions[edgeType],
        };

        // color witch edges red if they are open
        if (edgeType === "switch") {
            newEdge.switchColor = "#ff0000";
            newEdge.type = "switch";
            newEdge.iconType = "switch";
            newEdge.switchSize = 8;
        }

        // draw an IEEE regulator symbol in the middle of regulator edges
        if (edgeType === "regulator") {
            newEdge.type = "regulator";
            newEdge.iconType = "regulator";
            newEdge.regulatorSize = 16;
        }

        // draw an IEEE transformer symbol in the middle of transformer edges
        if (edgeType === "transformer") {
            newEdge.type = "transformer";
            newEdge.iconType = "transformer";
            newEdge.transformerSize = 16;
        }

        this.graph.addEdgeWithKey(edgeID, fromNode, toNode, newEdge);
    };

    // ============================================================================
    // EXTERNAL SOCKET API
    // Methods driven by the socket "load-graph" / "update" / "add-*" / "delete-*"
    // events so external scripts can load and mutate the live visualization.
    // ============================================================================

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

        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("graph-loaded"));
    };

    /**
     * Applies a color/size/hidden update to a single node or edge.
     * @param {Object} data - { id, elementType: "node"|"edge", updates: { color, size, hidden } }
     *   Any value in `updates` may be null/undefined to leave that property unchanged.
     * @returns {boolean} whether the update was applied
     */
    applyUpdate = (data) => {
        if (!data || typeof data !== "object") {
            console.warn("[GraphHelper] update: invalid payload.", data);
            return false;
        }

        const { id, elementType, updates } = data;
        if (id === undefined || id === null || !updates || typeof updates !== "object") {
            console.warn("[GraphHelper] update: payload needs 'id' and an 'updates' object.", data);
            return false;
        }

        let setAttr;
        if (elementType === "node") {
            if (!this.graph.hasNode(id)) {
                console.warn(`[GraphHelper] update: node "${id}" not found.`);
                return false;
            }
            setAttr = (key, value) => this.graph.setNodeAttribute(id, key, value);
        } else if (elementType === "edge") {
            if (!this.graph.hasEdge(id)) {
                console.warn(`[GraphHelper] update: edge "${id}" not found.`);
                return false;
            }
            setAttr = (key, value) => this.graph.setEdgeAttribute(id, key, value);
        } else {
            console.warn(`[GraphHelper] update: unknown elementType "${elementType}".`);
            return false;
        }

        const { color, size, hidden } = updates;
        // null / undefined means "leave this property unchanged"
        if (color !== null && color !== undefined) setAttr("color", color);
        if (size !== null && size !== undefined) setAttr("size", size);
        if (hidden !== null && hidden !== undefined) setAttr("hidden", hidden);

        this.sigmaInstance?.refresh();
        return true;
    };

    /**
     * Adds a single node to the live graph from a GLIMPSE-format object:
     *   { objectType, elementType: "node", attributes: { id|name, x?, y?, ... } }
     * @returns {boolean} whether the node was added
     */
    addNode = (obj) => {
        if (!obj || typeof obj !== "object" || !obj.attributes) {
            console.warn("[GraphHelper] add-node: payload must include an 'attributes' object.", obj);
            return false;
        }

        if (!this.#theme || !this.#theme.groups) this.setThemeObject();

        const attributes = obj.attributes;
        const objectType = obj.objectType ?? obj.name ?? "node";
        const nodeID = attributes.id ?? attributes.name;

        if (nodeID === undefined || nodeID === null) {
            console.warn("[GraphHelper] add-node: attributes must include an 'id' or 'name'.", obj);
            return false;
        }
        if (this.graph.hasNode(nodeID)) {
            console.warn(`[GraphHelper] add-node: node "${nodeID}" already exists.`);
            return false;
        }

        // Register a theme entry + type for previously-unseen node types
        if (!(objectType in this.#theme.groups)) {
            this.#theme.groups[objectType] = { size: 4, color: this.getRandomColor() };
        }
        if (!this.nodeTypes.includes(objectType)) this.nodeTypes.push(objectType);

        // Place the node at the supplied coordinates, or the center of the graph
        const midX = (this.#boundsCoords.maxX + this.#boundsCoords.minX) / 2;
        const midY = (this.#boundsCoords.maxY + this.#boundsCoords.minY) / 2;
        const x = attributes.x !== undefined ? parseFloat(attributes.x) : midX;
        const y = attributes.y !== undefined ? parseFloat(attributes.y) : midY;

        const node = {
            label: attributes.name ?? String(nodeID),
            elementType: "node",
            group: objectType,
            attributes,
            x,
            y,
            fixed: false,
            ...this.#theme.groups[objectType],
        };
        node.attributesLabel = this.getTitle(attributes);

        this.objectTypeCount.nodes[objectType] = (this.objectTypeCount.nodes[objectType] ?? 0) + 1;

        this.graph.addNode(nodeID, node);
        this.setLegendData();
        this.sigmaInstance?.refresh();
        return true;
    };

    /**
     * Adds a single edge to the live graph from a GLIMPSE-format object:
     *   { objectType, elementType: "edge", attributes: { id?, from, to, ... } }
     * Both endpoint nodes must already exist.
     * @returns {boolean} whether the edge was added
     */
    addEdge = (obj) => {
        if (!obj || typeof obj !== "object" || !obj.attributes) {
            console.warn("[GraphHelper] add-edge: payload must include an 'attributes' object.", obj);
            return false;
        }

        if (!this.#theme || !this.#theme.edgeOptions) this.setThemeObject();

        const attributes = obj.attributes;
        const objectType = obj.objectType ?? obj.name ?? "edge";
        const fromNode = attributes.from;
        const toNode = attributes.to;
        const edgeID = attributes.id ?? `${fromNode}->${toNode}`;

        if (fromNode === undefined || toNode === undefined) {
            console.warn("[GraphHelper] add-edge: attributes must include 'from' and 'to'.", obj);
            return false;
        }
        if (!this.graph.hasNode(fromNode) || !this.graph.hasNode(toNode)) {
            console.warn(
                `[GraphHelper] add-edge: both endpoints "${fromNode}" and "${toNode}" must exist.`,
            );
            return false;
        }
        if (this.graph.hasEdge(edgeID)) {
            console.warn(`[GraphHelper] add-edge: edge "${edgeID}" already exists.`);
            return false;
        }

        if (!(objectType in this.#theme.edgeOptions)) {
            this.#theme.edgeOptions[objectType] = { color: this.getRandomColor(), width: 2 };
        }
        if (!this.edgeTypes.includes(objectType)) this.edgeTypes.push(objectType);

        const newEdge = {
            elementType: "edge",
            group: objectType,
            type: "straight",
            dotColor: "#ff0000",
            dotSize: 6,
            dotSpeed: 0.25,
            dotPhase: Math.random(),
            flowDirection: 1, // -1 for opposite flow
            dotCount: 1,
            attributes: { ...attributes, id: edgeID, from: fromNode, to: toNode },
            ...this.#theme.edgeOptions[objectType],
        };

        // color switch edges red if they are open
        if (objectType === "switch") {
            newEdge.switchColor = "#ff0000";
            newEdge.type = "switch";
            newEdge.iconType = "switch";
            newEdge.switchSize = 8;
        }

        // draw an IEEE regulator symbol in the middle of regulator edges
        if (objectType === "regulator") {
            newEdge.type = "regulator";
            newEdge.iconType = "regulator";
            newEdge.regulatorSize = 16;
        }

        // draw an IEEE transformer symbol in the middle of transformer edges
        if (objectType === "transformer") {
            newEdge.type = "transformer";
            newEdge.iconType = "transformer";
            newEdge.transformerSize = 16;
        }

        this.objectTypeCount.edges[objectType] = (this.objectTypeCount.edges[objectType] ?? 0) + 1;

        this.graph.addEdgeWithKey(edgeID, fromNode, toNode, newEdge);
        this.assignParallelEdgeCurvatures(this.graph);
        this.setLegendData();
        this.sigmaInstance?.refresh();
        return true;
    };

    /**
     * Removes a node (and its attached edges) from the live graph.
     * Accepts either the node id or an object containing an `id` key.
     * @returns {boolean} whether the node was removed
     */
    deleteNode = (nodeID) => {
        const id = typeof nodeID === "object" && nodeID !== null ? (nodeID.id ?? nodeID.nodeID) : nodeID;

        if (!this.graph.hasNode(id)) {
            console.warn(`[GraphHelper] delete-node: node "${id}" not found.`);
            return false;
        }

        const group = this.graph.getNodeAttribute(id, "group");

        // Keep edge type counts honest by tallying the edges dropNode will remove
        this.graph.forEachEdge(id, (_edge, attrs) => {
            if (attrs.group && this.objectTypeCount.edges[attrs.group] > 0)
                this.objectTypeCount.edges[attrs.group]--;
        });

        this.graph.dropNode(id); // also removes attached edges
        if (group && this.objectTypeCount.nodes[group] > 0) this.objectTypeCount.nodes[group]--;

        this.setLegendData();
        this.sigmaInstance?.refresh();
        return true;
    };

    /**
     * Removes an edge from the live graph.
     * Accepts either the edge id or an object containing an `id` key.
     * @returns {boolean} whether the edge was removed
     */
    deleteEdge = (edgeID) => {
        const id = typeof edgeID === "object" && edgeID !== null ? (edgeID.id ?? edgeID.edgeID) : edgeID;

        if (!this.graph.hasEdge(id)) {
            console.warn(`[GraphHelper] delete-edge: edge "${id}" not found.`);
            return false;
        }

        const group = this.graph.getEdgeAttribute(id, "group");
        this.graph.dropEdge(id);
        if (group && this.objectTypeCount.edges[group] > 0) this.objectTypeCount.edges[group]--;

        this.setLegendData();
        this.sigmaInstance?.refresh();
        return true;
    };

    export = () => {
        const edgeIDs = this.graph.edges();
        const nodeIDs = this.graph.nodes();

        // Update glmFileData with current graph state
        Object.keys(this.glmFileData).forEach((file) => {
            this.glmFileData[file].objects.forEach((obj) => {
                if ("attributes" in obj && nodeIDs.includes(obj.attributes.name)) {
                    const sigmaNode = this.graph.getNodeAttributes(obj.attributes.name);
                    obj.attributes = sigmaNode.attributes;
                }

                if ("attributes" in obj && edgeIDs.includes(obj.attributes.name)) {
                    const sigmaEdge = this.graph.getEdgeAttributes(obj.attributes.name);
                    obj.attributes = sigmaEdge.attributes;
                }
            });
        });

        return this.glmFileData;
    };

    setGraphData = (fileData) => {
        // save glm file data for exporting changes
        if (!this.isCIM) {
            this.glmFileData = fileData;
        }

        const newGraph = new MultiUndirectedGraph({
            allowSelfLoops: true,
            type: "undirected",
        });

        const files = Object.keys(fileData).map((file) => fileData[file]);

        // get nodes
        for (const file of files) {
            for (let obj of file.objects) {
                const attributes = obj.attributes;
                // get the key that is at the top of the object which can be "name" or "objectType"
                const objectType = obj.objectType ?? obj.name;
                // get the key that is used for the objects id which can be "id" or "name"
                const nodeID = attributes.id ?? attributes.name;

                if (this.nodeTypes.length > 0 && this.nodeTypes.includes(objectType)) {
                    if ("x" in attributes && "y" in attributes) {
                        const node = {
                            label: attributes.name ?? nodeID,
                            elementType: "node",
                            attributes: attributes,
                            group: objectType,
                            fixed: true,
                            community: attributes.dist_area_id ?? undefined,
                            x: parseFloat(attributes.x),
                            y: parseFloat(attributes.y),
                            ...this.#theme.groups[objectType],
                        };

                        if (node.x !== undefined && node.x > this.#boundsCoords.maxX)
                            this.#boundsCoords.maxX = node.x;
                        if (node.x !== undefined && node.x < this.#boundsCoords.minX)
                            this.#boundsCoords.minX = node.x;
                        if (node.y !== undefined && node.y > this.#boundsCoords.maxY)
                            this.#boundsCoords.maxY = node.y;
                        if (node.y !== undefined && node.y < this.#boundsCoords.minY)
                            this.#boundsCoords.minY = node.y;

                        node.attributesLabel = this.getTitle(attributes);

                        if (objectType in this.objectTypeCount.nodes)
                            this.objectTypeCount.nodes[objectType]++;
                        else this.objectTypeCount.nodes[objectType] = 1;

                        newGraph.addNode(nodeID, node);
                        this.#hasFixedNodes = true;
                        continue;
                    }

                    const node = {
                        label: attributes.name ?? nodeID,
                        elementType: "node",
                        attributes: attributes,
                        group: objectType,
                        community: attributes.dist_area_id ?? undefined,
                        fixed: false,
                        ...this.#theme.groups[objectType],
                    };

                    node["attributesLabel"] = this.getTitle(attributes);

                    if (objectType in this.objectTypeCount.nodes)
                        this.objectTypeCount.nodes[objectType]++;
                    else this.objectTypeCount.nodes[objectType] = 1;

                    try {
                        newGraph.addNode(nodeID, node);
                    } catch (err) {
                        console.log(err);
                        console.log(nodeID);
                        console.log(node);
                    }
                } else if ("elementType" in obj && obj.elementType === "node") {
                    if (!(objectType in this.#theme.groups)) {
                        this.#theme.groups[objectType] = {
                            size: 4,
                            color: iwanthue(1)[0],
                        };
                    }

                    const node = {
                        id: nodeID,
                        label: attributes.name ?? nodeID,
                        elementType: obj.elementType,
                        attributes: attributes,
                        group: objectType,
                    };

                    if (!this.nodeTypes.includes(objectType)) this.nodeTypes.push(objectType);

                    if (objectType in this.objectTypeCount.nodes)
                        this.objectTypeCount.nodes[objectType]++;
                    else this.objectTypeCount.nodes[objectType] = 1;

                    node["attributesLabel"] = this.getTitle(attributes);
                    newGraph.addNode(nodeID, node);
                }
            }
        }

        // Collect distribution area metadata from node attributes. A node may
        // belong to several nested areas (dist_areas list); fall back to the
        // flat dist_area_* fields for backward compatibility.
        this.distributionAreas = {};
        const collectArea = (dist_area_type, dist_area_id, dist_area_name) => {
            if (!dist_area_type || !dist_area_id) return;
            if (!this.distributionAreas[dist_area_type]) {
                this.distributionAreas[dist_area_type] = [];
            }
            if (!this.distributionAreas[dist_area_type].find((a) => a.id === dist_area_id)) {
                this.distributionAreas[dist_area_type].push({
                    name: dist_area_name || dist_area_id,
                    id: dist_area_id,
                });
            }
        };
        newGraph.forEachNode((_nodeId, attrs) => {
            const attributes = attrs.attributes || {};
            const areas = attributes.dist_areas;
            if (Array.isArray(areas) && areas.length > 0) {
                areas.forEach((a) => collectArea(a.dist_area_type, a.dist_area_id, a.dist_area_name));
            } else {
                collectArea(
                    attributes.dist_area_type,
                    attributes.dist_area_id,
                    attributes.dist_area_name,
                );
            }
        });

        // get edges
        for (const file of files) {
            for (const obj of file.objects) {
                const attributes = obj.attributes;
                const objectType = obj.objectType ?? obj.name;

                // Special case where we check for nodes that have a parent attribute and create an edge between them
                if (this.nodeTypes.includes(objectType) && "parent" in attributes) {
                    const nodeID = attributes.id ?? attributes.name;
                    const parent = attributes.parent;
                    const edgeID = `${parent}->${nodeID}`;

                    if ("parentChild" in this.objectTypeCount.edges)
                        this.objectTypeCount.edges["parentChild"]++;
                    else this.objectTypeCount.edges["parentChild"] = 1;

                    newGraph.addEdgeWithKey(edgeID, parent, nodeID, {
                        elementType: "edge",
                        group: "parentChild",
                        type: "straight",
                        size: this.#theme.edgeOptions.parentChild.width,
                        length: "length" in attributes ? parseFloat(attributes.length) : null,
                        attributes: { to: parent, from: nodeID, id: edgeID },
                    });

                    continue;
                }

                if (this.edgeTypes.includes(objectType)) {
                    const edgeFrom = attributes.from;
                    const edgeTo = attributes.to;
                    const edgeID = attributes.id ?? attributes.name;

                    if (objectType in this.objectTypeCount.edges)
                        this.objectTypeCount.edges[objectType]++;
                    else this.objectTypeCount.edges[objectType] = 1;

                    const newEdge = {
                        elementType: "edge",
                        group: objectType,
                        type: "straight",
                        dotColor: "#ff0000",
                        dotSize: 6,
                        dotSpeed: 0.25,
                        dotPhase: Math.random(),
                        flowDirection: 1, // -1 for opposite flow
                        dotCount: 1,
                        attributes: attributes,
                        ...this.#theme.edgeOptions[objectType],
                    };

                    // color witch edges red if they are open
                    if (objectType === "switch") {
                        newEdge.switchColor = "#ff0000";
                        newEdge.type = "switch";
                        newEdge.iconType = "switch";
                        newEdge.switchSize = 8;
                    }

                    // draw an IEEE symbol in the middle of transformer edges:
                    // regulators (transformers tagged class_type "regulator") get the
                    // tap-changer arrow, all other transformers get the plain windings.
                    if (objectType === "regulator") {
                        newEdge.type = "regulator";
                        newEdge.iconType = "regulator";
                        newEdge.regulatorSize = 16;
                    } else if (objectType === "transformer") {
                        if (attributes?.class_type === "regulator") {
                            newEdge.type = "regulator";
                            newEdge.iconType = "regulator";
                            newEdge.regulatorSize = 16;
                        } else {
                            newEdge.type = "transformer";
                            newEdge.iconType = "transformer";
                            newEdge.transformerSize = 16;
                        }
                    }

                    newGraph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, newEdge);

                    continue;
                } else if ("elementType" in obj && obj.elementType === "edge") {
                    const edgeFrom = attributes.from;
                    const edgeTo = attributes.to;
                    const edgeID = attributes.id ?? `${edgeFrom}->${edgeTo}`;

                    console.log("Processing edge:", edgeID, "of type:", objectType);

                    if (!(objectType in this.#theme.edgeOptions))
                        this.#theme.edgeOptions[objectType] = {
                            color: this.getRandomColor(),
                            width: 2,
                        };

                    if (objectType in this.objectTypeCount.edges)
                        this.objectTypeCount.edges[objectType]++;
                    else this.objectTypeCount.edges[objectType] = 1;

                    if (!this.edgeTypes.includes(objectType)) this.edgeTypes.push(objectType);

                    newGraph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, {
                        elementType: "edge",
                        group: objectType,
                        type: "straight",
                        length: attributes.length ?? null,
                        size: this.#theme.edgeOptions[objectType].size,
                        attributes: attributes,
                    });
                }
            }
        }

        if (this.#hasFixedNodes) {
            // Ensure bounds have a minimum spread so nodes don't stack
            const MIN_SPREAD = 500;
            const rangeX = Math.max(this.#boundsCoords.maxX - this.#boundsCoords.minX, MIN_SPREAD);
            const rangeY = Math.max(this.#boundsCoords.maxY - this.#boundsCoords.minY, MIN_SPREAD);
            const centerX = (this.#boundsCoords.maxX + this.#boundsCoords.minX) / 2;
            const centerY = (this.#boundsCoords.maxY + this.#boundsCoords.minY) / 2;

            newGraph.forEachNode((node, attrs) => {
                if (!attrs.fixed) {
                    const neighbors = newGraph.neighbors(node);

                    // Try to find a neighbor that already has valid coordinates
                    const anchorNeighbor = neighbors.find((n) => {
                        const nAttrs = newGraph.getNodeAttributes(n);
                        return (
                            nAttrs.x !== undefined &&
                            nAttrs.y !== undefined &&
                            !isNaN(nAttrs.x) &&
                            !isNaN(nAttrs.y)
                        );
                    });

                    if (anchorNeighbor) {
                        const neighborAttrs = newGraph.getNodeAttributes(anchorNeighbor);
                        // Offset proportional to coordinate space (5% of the range)
                        // const maxOffsetX = rangeX * 0.05;
                        // const maxOffsetY = rangeY * 0.05;
                        // const offsetX = (Math.random() - 0.05) * 2 * maxOffsetX;
                        // const offsetY = (Math.random() - 0.05) * 2 * maxOffsetY;
                        newGraph.setNodeAttribute(node, "x", neighborAttrs.x);
                        newGraph.setNodeAttribute(node, "y", neighborAttrs.y);
                    } else {
                        // No valid neighbor → place randomly within bounds
                        const randX = centerX + (Math.random() - 0.05) * rangeX;
                        const randY = centerY + (Math.random() - 0.05) * rangeY;
                        newGraph.setNodeAttribute(node, "x", randX);
                        newGraph.setNodeAttribute(node, "y", randY);
                    }

                    newGraph.setNodeAttribute(node, "fixed", false);
                }
            });
        } else {
            // apply circlepack layout for initial node positions
            if (newGraph.order > 1_000) {
                louvain.assign(newGraph, {
                    nodeCommunityAttribute: "CID",
                    resolution: 0.8,
                });
                circlepack.assign(newGraph, { hierarchyAttributes: ["CID"], scale: 1, center: 0 });
            } else {
                circlepack.assign(newGraph);
            }

            // Pre-warm: run a synchronous FA2 pass so the graph renders already
            // unraveled instead of requiring the user to press play and wait.
            // this.#preWarmLayout(newGraph);
        }

        this.assignParallelEdgeCurvatures(newGraph);

        // create the legend graph object
        this.setLegendData();
        this.graph = newGraph;
    };
}

const graphHelper = new GraphHelper();

export default graphHelper;
