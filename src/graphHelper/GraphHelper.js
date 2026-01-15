import { MultiUndirectedGraph, MultiGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import iwanthue from "iwanthue";
import circlepack from "graphology-layout/circlepack";
import theme from "../themes/PowerGrid.theme.json";

class GraphHelper {
   // private
   #boundsCoords = { maxX: 0, maxY: 0, minX: 0, minY: 0 };
   #theme = null;
   #highlightedGroups = [];
   #highlightedEdgeTypes = [];
   #hasFixedNodes = false;

   // constants
   #ROTATE_ANGLE = Math.PI / 12; // 15 degrees in radians

   // public
   sigmaInstance = null;
   highlightedNodeIDs = []; // contain the IDs of highlighted nodes
   highlightedEdgeIDs = []; // contains the IDs of highlighted edges
   highlightedObjects = [];
   focusIndex = -1;
   nodeTypes = null;
   edgeTypes = null;
   communitiesArray = [];
   communityColorPallet = {};
   layout = null;

   constructor() {
      this.graph = new MultiUndirectedGraph({
         allowSelfLoops: true,
         type: "undirected",
      });
      this.legendGraph = new MultiGraph();
      this.#theme = theme;
      this.nodeTypes = Object.keys(this.#theme.groups);
      this.edgeTypes = Object.keys(this.#theme.edgeOptions);
      this.objectTypeCount = {
         nodes: Object.keys(this.#theme.groups).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
         edges: Object.keys(this.#theme.edgeOptions).reduce((o, key) => ({ ...o, [key]: 0 }), {}),
      };
   }

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

   highlightEdgeTypes = (edgeType) => {
      if (this.#highlightedEdgeTypes.includes(edgeType)) {
         this.#highlightedEdgeTypes = this.#highlightedEdgeTypes.filter(
            (hEdgeType) => hEdgeType !== edgeType
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
               ration: 0.05,
            },
            { duration: 1000 }
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
                  ...theme.groups[nodeType],
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
               ...theme.groups[nodeType],
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

         if (nodeType in theme.groups) {
            this.legendGraph.addNode(nodeType, {
               label: `${nodeType}\n[${this.objectTypeCount.nodes[nodeType]}]`,
               forceLabel: true,
               ...theme.groups[nodeType],
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
            ...theme.groups[nodeType],
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

         if (type in theme.edgeOptions) {
            this.legendGraph.addEdgeWithKey(type, nodeIDFrom, nodeIDTo, {
               id: type,
               from: nodeIDFrom,
               to: nodeIDTo,
               type: "line",
               title: "Double Click to Highlight !",
               label: `${type} [${this.objectTypeCount.edges[type]}]`,
               forceLabel: true,
               size: 8,
               color: theme.edgeOptions[type].color,
            });
         } else {
            this.legendGraph.addEdgeWithKey(type, nodeIDFrom, nodeIDTo, {
               id: type,
               from: nodeIDFrom,
               to: nodeIDTo,
               type: "line",
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

   resetGreatestCoords = () => {
      this.#boundsCoords = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
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

   setGraphData = (fileData) => {
      this.resetObjectTypeCounts();
      this.resetGreatestCoords();
      this.graph.clear();
      const keys = ["id", "objectType", "name"];
      const files = Object.keys(fileData).map((file) => fileData[file]);

      // get nodes
      for (const file of files) {
         for (let obj of file.objects) {
            const attributes = obj.attributes;
            // get the key that is at the top of the object which can be "name" or "objectType"
            const nameForObjType = keys.find((key) => key in obj);
            const objectType = obj[nameForObjType];
            // get the key that is used for the objects id which can be "id" or "name"
            const nameForObjID = keys.find((key) => key in attributes);
            const nodeID = attributes[nameForObjID];

            if (this.nodeTypes.length > 0 && this.nodeTypes.includes(objectType)) {
               if ("x" in attributes && "y" in attributes) {
                  const node = {
                     label: "name" in attributes ? attributes.name : nodeID,
                     elementType: "node",
                     attributes: attributes,
                     group: objectType,
                     fixed: true,
                     community: attributes.feeder ?? undefined,
                     x: attributes.x.length > 0 ? parseFloat(attributes.x) : undefined,
                     y: attributes.y.length > 0 ? parseFloat(attributes.y) : undefined,
                     ...theme.groups[objectType],
                  };

                  if (node.x !== undefined && node.x > this.#boundsCoords.maxX)
                     this.#boundsCoords.maxX = node.x;
                  if (node.x !== undefined && node.x < this.#boundsCoords.minX)
                     this.#boundsCoords.minX = node.x;
                  if (node.y !== undefined && node.y > this.#boundsCoords.maxY)
                     this.#boundsCoords.maxY = node.y;
                  if (node.y !== undefined && node.y < this.#boundsCoords.minY)
                     this.#boundsCoords.maxY = node.y;

                  node.attributesLabel = this.getTitle(attributes);

                  if (objectType in this.objectTypeCount.nodes)
                     this.objectTypeCount.nodes[objectType]++;
                  else this.objectTypeCount.nodes[objectType] = 1;

                  this.graph.addNode(nodeID, node);
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
                  ...theme.groups[objectType],
               };

               node["attributesLabel"] = this.getTitle(attributes);

               if (objectType in this.objectTypeCount.nodes)
                  this.objectTypeCount.nodes[objectType]++;
               else this.objectTypeCount.nodes[objectType] = 1;

               // Assign random initial positions for nodes without coordinates
               this.graph.addNode(nodeID, node);
            } else if ("elementType" in obj && obj.elementType === "node") {
               if (!(objectType in theme.groups)) {
                  theme.groups[objectType] = {
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

               this.graph.addNode(nodeID, node);
            }
         }
      }

      // get edges
      for (const file of files) {
         for (let obj of file.objects) {
            const attributes = obj.attributes;
            const nameForObjType = keys.find((key) => Object.keys(obj).includes(key));
            const objectType = obj[nameForObjType];
            const nameForObjID = keys.find((key) => Object.keys(attributes).includes(key));

            if (this.nodeTypes.includes(objectType) && "parent" in attributes) {
               const nodeID = attributes[nameForObjID];
               const parent = attributes.parent;
               const edgeID = `${parent}-${nodeID}`;

               if ("parentChild" in this.objectTypeCount.edges)
                  this.objectTypeCount.edges["parentChild"]++;
               else this.objectTypeCount.edges["parentChild"] = 1;

               this.graph.addEdgeWithKey(edgeID, parent, nodeID, {
                  elementType: "edge",
                  group: "parentChild",
                  type: "line",
                  size: this.#theme.edgeOptions.parentChild.width,
                  length: "length" in attributes ? parseFloat(attributes.length) : null,
                  attributes: { to: parent, from: nodeID, id: edgeID },
               });

               continue;
            } else if (this.edgeTypes.includes(objectType)) {
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = "name" in attributes ? attributes.name : attributes.id;

               if (objectType in this.objectTypeCount.edges)
                  this.objectTypeCount.edges[objectType]++;
               else this.objectTypeCount.edges[objectType] = 1;

               this.graph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, {
                  elementType: "edge",
                  group: objectType,
                  type: "line",
                  color: this.#theme.edgeOptions[objectType].color,
                  size: this.#theme.edgeOptions[objectType].width,
                  length: "length" in attributes ? parseFloat(attributes.length) : null,
                  attributes: attributes,
               });

               continue;
            } else if ("elementType" in obj && obj.elementType === "edge") {
               const edgeFrom = attributes.from;
               const edgeTo = attributes.to;
               const edgeID = attributes.id ?? `${edgeFrom}-${edgeTo}`;

               if (!(objectType in theme.edgeOptions))
                  theme.edgeOptions[objectType] = { color: this.getRandomColor(), width: 2 };

               if (objectType in this.objectTypeCount.edges)
                  this.objectTypeCount.edges[objectType]++;
               else this.objectTypeCount.edges[objectType] = 1;

               if (!this.edgeTypes.includes(objectType)) this.edgeTypes.push(objectType);

               this.graph.addEdgeWithKey(edgeID, edgeFrom, edgeTo, {
                  elementType: "edge",
                  group: objectType,
                  type: "line",
                  length: "length" in attributes ? parseFloat(attributes.length) : null,
                  size: this.#theme.edgeOptions[objectType].width,
                  attributes: attributes,
               });
            }
         }
      }

      if (this.#hasFixedNodes) {
         // place unfixed nodes near their neighbor
         this.graph.forEachNode((node, attrs) => {
            if (!attrs.fixed) {
               const neighbors = this.graph.neighbors(node);
               if (neighbors.length > 0) {
                  const neighbor = neighbors[0];
                  const neighborAttrs = this.graph.getNodeAttributes(neighbor);
                  const offsetX = Math.random() * 250 - 200;
                  const offsetY = Math.random() * 250 - 200;
                  this.graph.setNodeAttribute(node, "x", neighborAttrs.x + offsetX);
                  this.graph.setNodeAttribute(node, "y", neighborAttrs.y + offsetY);
                  this.graph.setNodeAttribute(node, "fixed", false);
               } else {
                  // if no neighbors, place randomly within greatest coords
                  const rangeX = this.#boundsCoords.maxX - this.#boundsCoords.minX;
                  const rangeY = this.#boundsCoords.maxY - this.#boundsCoords.minY;
                  const randX = this.#boundsCoords.minX + Math.random() * rangeX;
                  const randY = this.#boundsCoords.minY + Math.random() * rangeY;
                  this.graph.setNodeAttribute(node, "x", randX);
                  this.graph.setNodeAttribute(node, "y", randY);
                  this.graph.setNodeAttribute(node, "fixed", false);
               }
            }
         });

         if (this.graph.order > 1500) {
            // Color all nodes that belong to a certain feeder
            const communitiesSet = new Set();

            this.graph.forEachNode((_nodeID, attrs) => {
               if (attrs.community) {
                  communitiesSet.add(attrs.attributes.feeder);
               }
            });

            if (!communitiesSet.size) {
               this.setLegendData();
               return;
            }

            this.communitiesArray = Array.from(communitiesSet);
            this.communityColorPallet = iwanthue(communitiesSet.size).reduce(
               (acc, color, i) => ({ ...acc, [this.communitiesArray[i]]: color }),
               {}
            );

            this.graph.forEachNode((nodeID, attrs) => {
               if ("feeder" in attrs.attributes) {
                  this.graph.setNodeAttribute(
                     nodeID,
                     "color",
                     this.communityColorPallet[attrs.attributes.feeder]
                  );
               }
            });
         }
      } else {
         // apply circlepack layout for initial node positions
         if (this.graph.order > 1000) {
            louvain.assign(this.graph, { nodeCommunityAttribute: "CID", resolution: 0.7 });
            circlepack.assign(this.graph, { hierarchyAttributes: ["CID"] });
         } else {
            circlepack.assign(this.graph);
         }
      }

      // create the legend graph object
      this.setLegendData();
   };
}

const graphHelper = new GraphHelper();

export default graphHelper;
