import { MultiUndirectedGraph, MultiGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import iwanthue from "iwanthue";
import circlepack from "graphology-layout/circlepack";
import POWER_GRID_THEME from "../themes/PowerGrid.theme.json";
import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";

class GraphHelper {
    // private
    #boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
    #theme = {};
    #highlightedGroups = [];
    #highlightedEdgeTypes = [];
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
    communitiesArray = [];
    communityColorPallet = {};
    themeName = "feeder-model-theme";
    selectedGridappsdModels = [];

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
                    nodes: Object.keys(this.#theme.groups).reduce(
                        (o, key) => ({ ...o, [key]: 0 }),
                        {},
                    ),
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
            edges: Object.keys(this.#theme.edgeOptions).reduce(
                (o, key) => ({ ...o, [key]: 0 }),
                {},
            ),
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
            this.#highlightedGroups = this.#highlightedGroups.filter(
                (hGroup) => hGroup !== groupName,
            );
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
            this.#highlightedGroups.includes(groupName) ||
            this.#highlightedEdgeTypes.includes(groupName)
        );
    };

    reset = () => {
        this.#highlightedEdgeTypes.length = 0;
        this.#highlightedGroups.length = 0;
        this.highlightedNodeIDs.length = 0;
        this.highlightedEdgeIDs.length = 0;
        this.highlightedObjects.length = 0;
        this.focusIndex = -1;

        // show any hidden edges and nodes
        this.graph.updateEachEdgeAttributes((e, attrs) => ({ ...attrs, hidden: false }));
        this.graph.updateEachNodeAttributes((n, attrs) => ({ ...attrs, hidden: false }));

        this.graph.updateEachEdgeAttributes((e, attrs) => ({
            ...attrs,
            type: attrs.type === "animated" ? "straight" : attrs.type,
        }));
    };

    clearGraphData = () => {
        this.resetObjectTypeCounts();

        // Clear highlighted arrays and state
        this.#highlightedEdgeTypes.length = 0;
        this.#highlightedGroups.length = 0;
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
            title.push(`${key}: ${val}`);
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
                    type: "straight",
                    title: "Double Click to Highlight !",
                    label: `${type} [${this.objectTypeCount.edges[type]}]`,
                    forceLabel: true,
                    size: 8,
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
            edges: Object.keys(this.#theme.edgeOptions).reduce(
                (o, key) => ({ ...o, [key]: 0 }),
                {},
            ),
        };
    };

    rotateCCW = () => {
        this.graph.forEachNode((node, attrs) => {
            const newX =
                attrs.x * Math.cos(this.#ROTATE_ANGLE) - attrs.y * Math.sin(this.#ROTATE_ANGLE);
            const newY =
                attrs.x * Math.sin(this.#ROTATE_ANGLE) + attrs.y * Math.cos(this.#ROTATE_ANGLE);

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

    _getCurvature(index, maxIndex) {
        if (maxIndex <= 0) throw new Error("Invalid maxIndex");
        if (index < 0) return -this._getCurvature(-index, maxIndex);

        const amplitude = 3.5;
        const maxCurvature =
            amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE;

        return (maxCurvature * index) / maxIndex;
    }

    assignParallelEdgeCurvatures = (graph) => {
        // Step 1: let the library detect which edges are parallel
        indexParallelEdgesIndex(graph, {
            edgeIndexAttribute: "parallelIndex",
            edgeMinIndexAttribute: "parallelMinIndex",
            edgeMaxIndexAttribute: "parallelMaxIndex",
        });

        // Step 2: assign type + curvature based on the indexed values
        graph.forEachEdge((edge, { parallelIndex, parallelMinIndex, parallelMaxIndex }) => {
            if (typeof parallelMinIndex === "number") {
                // ── Undirected parallel group ──
                // The edge at index 0 gets to stay straight (the "primary" edge).
                // All others are curved so they fan out on either side.
                graph.mergeEdgeAttributes(edge, {
                    type: parallelIndex ? "curved" : "straight",
                    curvature: this._getCurvature(parallelIndex, parallelMaxIndex),
                });

                return;
            }

            if (typeof parallelIndex === "number") {
                // ── Directed parallel group (shouldn't happen in our undirected
                //    graph, but included for completeness) ──
                graph.mergeEdgeAttributes(edge, {
                    type: "curved",
                    curvature: this._getCurvature(parallelIndex, parallelMaxIndex),
                });
            }
        });
    };

    #isOpenSwitch = (switchAttributes) => {
        // check for "open" attribute
        if ("open" in switchAttributes || "status" in switchAttributes) {
            if (switchAttributes.status === "OPEN" || switchAttributes.open === "True") {
                return true;
            }
        }

        return false;
    };

    setGraphData = (fileData) => {
        const newGraph = new MultiUndirectedGraph({
            allowSelfLoops: true,
            type: "undirected",
        });

        console.log(fileData);
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
                            community: attributes.feeder ?? undefined,
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
                        community: attributes.feeder ?? undefined,
                        fixed: false,
                        ...this.#theme.groups[objectType],
                    };

                    node["attributesLabel"] = this.getTitle(attributes);

                    if (objectType in this.objectTypeCount.nodes)
                        this.objectTypeCount.nodes[objectType]++;
                    else this.objectTypeCount.nodes[objectType] = 1;

                    newGraph.addNode(nodeID, node);
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

        // get edges
        for (const file of files) {
            for (const obj of file.objects) {
                const attributes = obj.attributes;
                const objectType = obj.objectType ?? obj.name;

                // Special case where we check for nodes that have a parent attribute and create an edge between them
                if (this.nodeTypes.includes(objectType) && "parent" in attributes) {
                    const nodeID = attributes.id ?? attributes.name;
                    const parent = attributes.parent;
                    const edgeID = `${parent}-${nodeID}`;

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
                    let edgeSize = this.#theme.edgeOptions[objectType].width;
                    let edgeColor = this.#theme.edgeOptions[objectType].color;

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
                        color: edgeColor,
                        size: edgeSize,
                        length: attributes.length ?? null,
                        attributes: attributes,
                    };

                    // color witch edges red if they are open
                    if (objectType === "switch") {
                        newEdge.switchColor = "#ff0000";
                        newEdge.type = "switch";
                        newEdge.switchSize = 8;
                    }

                    newGraph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, newEdge);

                    continue;
                } else if ("elementType" in obj && obj.elementType === "edge") {
                    const edgeFrom = attributes.from;
                    const edgeTo = attributes.to;
                    const edgeID = attributes.id ?? `${edgeFrom}-${edgeTo}`;

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
                        size: this.#theme.edgeOptions[objectType].width,
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

            if (newGraph.order > 1500) {
                // Color all nodes that belong to a certain feeder
                const communitiesSet = new Set();

                newGraph.forEachNode((_nodeID, attrs) => {
                    if (attrs.community) {
                        communitiesSet.add(attrs.attributes.feeder);
                    }
                });

                if (!communitiesSet.size) {
                    this.setLegendData();
                    this.graph = newGraph;
                    return;
                }

                this.communitiesArray = Array.from(communitiesSet);
                this.communityColorPallet = iwanthue(communitiesSet.size).reduce(
                    (acc, color, i) => ({ ...acc, [this.communitiesArray[i]]: color }),
                    {},
                );

                newGraph.forEachNode((nodeID, attrs) => {
                    if ("feeder" in attrs.attributes) {
                        newGraph.setNodeAttribute(
                            nodeID,
                            "color",
                            this.communityColorPallet[attrs.attributes.feeder],
                        );
                    }
                });
            }
        } else {
            // apply circlepack layout for initial node positions
            if (newGraph.order > 1000) {
                louvain.assign(newGraph, { nodeCommunityAttribute: "CID", resolution: 0.7 });
                circlepack.assign(newGraph, { hierarchyAttributes: ["CID"] });
            } else {
                circlepack.assign(newGraph);
            }
        }

        this.assignParallelEdgeCurvatures(newGraph);

        // create the legend graph object
        this.setLegendData();
        this.graph = newGraph;
    };
}

const graphHelper = new GraphHelper();

export default graphHelper;
