const greatest = { x: 0, y: 0 };

/**
 * Generates a random color in hexadecimal format.
 * @returns A hexadecimal color
 */
export const getRandomColor = () => {
   const letters = "0123456789ABCDEF";
   let color = "#";

   while (color.length < 7) color += letters[Math.floor(Math.random() * 16)];

   return color;
};

/**
 * Converts an object of attributes from a node or edge to a string to be displayed
 * @param {Object} attributes - an object
 * @returns {string}
 */
export const getTitle = (attributes) => {
   const title = [];

   for (let [key, val] of Object.entries(attributes)) {
      title.push(`${key}: ${val}`);
   }

   return title.join("\n");
};

export const getHtmlLabel = (id, attributes) => {
   return `\t<b>${id}</b>\n\n` + getTitle(attributes);
};

/**
 * Updates uploaded data with any changes.
 * Then downloads the data back to the user's computer
 */
export const Export = (network, graphData, isGlm, isCim, fileData, newCIMobjs) => {
   if (isGlm) {
      const edgeIDs = graphData.edges.getIds();
      const nodeIDs = graphData.nodes.getIds();

      Object.keys(fileData).forEach((file) => {
         fileData[file].objects.forEach((obj) => {
            if ("attributes" in obj && nodeIDs.includes(obj.attributes.name)) {
               const visNode = graphData.nodes.get(obj.attributes.name);
               obj.attributes = visNode.attributes;
            }

            if ("attributes" in obj && edgeIDs.includes(obj.attributes.name)) {
               const visEdge = graphData.edges.get(obj.attributes.name);
               obj.attributes = visEdge.attributes;
            }
         });
      });

      window.glimpseAPI.json2glm(JSON.stringify(fileData));
   } else if (isCim) {
      console.log(Object.keys(fileData)[0]);
      if (newCIMobjs.length === 0) {
         const nodesWithoutCoords = graphData.nodes
            .get()
            .filter(
               (node) =>
                  !("x" in node.attributes && "y" in node.attributes) && node.type === "c_node"
            );

         const sendData = nodesWithoutCoords.map((node) => {
            const newCoords = network.getPosition(node.id);
            const nodeObj = {
               mRID: node.id,
               x: newCoords.x + greatest.x,
               y: newCoords.y + greatest.y
            };

            return nodeObj;
         });
         console.log(sendData);
         window.glimpseAPI.exportCoordinates({
            filepath: Object.keys(fileData)[0],
            data: sendData
         });
      } else {
         window.glimpseAPI.exportCIM(
            JSON.stringify({ filename: Object.keys(fileData)[0], objs: newCIMobjs })
         );
      }
   } else {
      alert("Export feature available for .glm uploads for now");
   }
};

/**
 *
 * @param {Object} keysMap - format: { [ name of key to rename ]: "new key name" }
 * @param {Object} obj - The object that contains the keys you would like to rename
 * @returns Obejct with renamed keys
 *
 * @example
 * keysMap = {
 *    name: 'firstName',
 *    job: 'passion'
 * };
 *
 * obj = {
 *    name: 'Bobo',
 *    job: 'Front-End Master'
 * };
 *
 *  renameKeys(keysMap, obj);
 * // { firstName: 'Bobo', passion: 'Front-End Master' }
 */
export const renameKeys = (keysMap, obj) => {
   return Object.keys(obj).reduce(
      (prev, key) => ({
         ...prev,
         ...{ [keysMap[key] || key]: obj[key] }
      }),
      {}
   );
};

/**
 * Zooms in on a node that maches the provided ID
 * @param {string} nodeID - the ID of a node
 */
export const nodeFocus = (node, network) => {
   const options = {
      scale: 3,
      locked: false,
      animation: {
         duration: 750,
         easing: "easeInOutQuart"
      }
   };

   if (typeof node.communityID !== "number" && network.clustering.isCluster(node.communityID)) {
      network.focus(node.communityID, options);
      return;
   } else if (
      typeof node.communityID === "number" &&
      network.clustering.isCluster(`CID_${node.communityID}`)
   ) {
      network.focus(`CID_${node.communityID}`, options);
      return;
   } else {
      network.focus(node.id, options);
   }
};

export const edgeFocus = (edge, network) => {
   let edgeID = edge.id;
   const edgeObject = network.body.edges[edgeID];

   const options = {
      scale: 3,
      locked: false,
      animation: {
         duration: 750,
         easing: "easeInOytQuart"
      }
   };

   const clusteredEdges = network.clustering.getClusteredEdges(edgeID);
   if (clusteredEdges.length > 1) {
      edgeID = clusteredEdges[0];
   } else if (network.clustering.findNode(edgeObject.from.id).length > 1) {
      nodeFocus(
         {
            id: edgeObject.from.id,
            communityID: network.body.nodes[edgeObject.from.id].options.communityID
         },
         network
      );
   } else {
      const focusedEdge = network.body.edges[edgeID];
      const x_1 = focusedEdge.from.x;
      const y_1 = focusedEdge.from.y;
      const x_2 = focusedEdge.to.x;
      const y_2 = focusedEdge.to.y;

      const midPoint = { x: (x_1 + x_2) / 2, y: (y_1 + y_2) / 2 };

      network.moveTo({ position: midPoint, ...options });
   }
};

/**
 * Create nodes and edges based on the object type being visualized in the main network
 * @param {Object} typeCounts - containes the counts of node and edge types
 * @returns {Object} an object containing the nodes and edges to be visualized in the legend network
 */
export const setLegendData = (typeCounts, theme, legendData) => {
   legendData.nodes.clear();
   legendData.edges.clear();

   const currentNodeTypes = [];
   const currentEdgeTypes = [];

   Object.entries(typeCounts.nodes).forEach(([type, count]) => {
      if (count > 0) currentNodeTypes.push(type);
   });

   Object.entries(typeCounts.edges).forEach(([type, count]) => {
      if (count > 0) currentEdgeTypes.push(type);
   });

   let x_increment = null;
   if (currentNodeTypes.length === 5) x_increment = 800 / 5;
   else if (currentNodeTypes.length === 2) x_increment = 400;
   else x_increment = 925 / 6;

   let farthest_x = 0;
   let current_x = 0;
   let current_y = 0;
   let rowNodeCount = 0;

   for (let nodeType of currentNodeTypes) {
      if (legendData.nodes.length === 0) {
         if (nodeType in theme.groups) {
            legendData.nodes.add({
               id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
               label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
               ...theme.groups[nodeType],
               size: 25,
               group: nodeType,
               title: "Double Click to Highlight !",
               x: current_x,
               y: current_y,
               physics: false,
               fixed: true
            });
            rowNodeCount++;
            continue;
         }

         legendData.nodes.add({
            id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
            label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
            size: 25,
            shape: "dot",
            groups: nodeType,
            title: "Double Click to Highlight !",
            x: current_x,
            y: current_y,
            physics: false,
            fixed: true
         });
         rowNodeCount++;
         continue;
      }

      if (rowNodeCount === 6) {
         farthest_x = current_x;
         rowNodeCount = 0;
         current_x = 0;
         current_y -= 125;
      } else {
         current_x += x_increment;
      }

      if (nodeType in theme.groups) {
         legendData.nodes.add({
            id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
            label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
            ...theme.groups[nodeType],
            size: 25,
            group: nodeType,
            title: "Double Click to Highlight !",
            x: current_x,
            y: current_y,
            physics: false,
            fixed: true
         });

         rowNodeCount++;
         continue;
      }

      legendData.nodes.add({
         id: `${nodeType}:${typeCounts.nodes[nodeType]}`,
         label: `${nodeType}\n[${typeCounts.nodes[nodeType]}]`,
         size: 25,
         shape: "dot",
         group: nodeType,
         title: "Double Click to Highlight !",
         x: current_x,
         y: current_y,
         physics: false,
         fixed: true
      });
      rowNodeCount++;
   }

   current_y = 125;
   currentEdgeTypes.forEach((type, index) => {
      legendData.nodes.add({
         id: `${type}:${index}`,
         x: current_x === farthest_x ? -250 : 0,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "#000"
      });

      legendData.nodes.add({
         id: `${type}:${index + 1}`,
         x: farthest_x === current_x ? 250 : farthest_x === 0 ? current_x : farthest_x,
         y: current_y,
         fixed: true,
         physcis: false,
         color: "#000"
      });

      if (type in theme.edgeOptions) {
         legendData.edges.add({
            id: type,
            from: `${type}:${index}`,
            to: `${type}:${index + 1}`,
            title: "Double Click to Highlight !",
            label: `${type} [${typeCounts.edges[type]}]`,
            width: 8,
            color: theme.edgeOptions[type].color
         });
      } else {
         legendData.edges.add({
            id: type,
            from: `${type}:${index}`,
            to: `${type}:${index + 1}`,
            label: `${type} [${typeCounts.edges[type]}]`,
            title: "Double Click to Highlight !",
            width: 8
         });
      }

      current_y += 65;
   });
};

/**
 * Hide a specific edge
 * @param {string} edgeID - The ID of an edge to hide
 */
export const hideEdge = (edgeID, data) => {
   const edgeToHide = data.edges.get(edgeID);
   edgeToHide.hidden = true;
   data.edges.update(edgeToHide);
};

/**
 * Hide all edges of a type
 * @param {string} edgeType - The type of edges to hide like: "overhead_line"
 */
export const hideEdges = (edgeID, data) => {
   const type = data.edges.get(edgeID).type;
   const edgesToHide = data.edges.get().map((edge) => {
      if (edge.type === type) {
         edge.hidden = true;
      }
      return edge;
   });
   data.edges.update(edgesToHide);
};

export const showAttributes = (show, data, filteredAttributes) => {
   if (!show) {
      data.nodes.update(
         data.nodes.map((node) => {
            node.label = node.id;
            return node;
         })
      );

      data.edges.update(
         data.edges.map((edge) => {
            edge.label = " ";
            return edge;
         })
      );
   } else {
      console.log(filteredAttributes);
      data.nodes.update(
         data.nodes.map((node) => {
            const labelAttributes = Object.entries(node.attributes).reduce(
               (acc, [attrName, value]) => {
                  if (filteredAttributes[node.type][attrName]) {
                     acc[attrName] = value;
                  }
                  return acc;
               },
               {}
            );
            node.label = getTitle(labelAttributes);
            return node;
         })
      );

      data.edges.update(
         data.edges.map((edge) => {
            const labelAttributes = Object.entries(edge.attributes).reduce(
               (acc, [attrName, value]) => {
                  if (edge.type === "parentChild") return acc;
                  if (filteredAttributes[edge.type][attrName]) {
                     acc[attrName] = value;
                  }
                  return acc;
               },
               {}
            );
            edge.label = getTitle(labelAttributes);
            return edge;
         })
      );
   }
};

/**
 * Hide edges or nodes of certain types
 * @param {string} objectType - the type of node or edge like "load" or "overhead_line"
 * @param {string} type - "node" or "edge"
 */
export const hideObjects = (objectType, type, data) => {
   if (type === "node") {
      const nodesToHide = data.nodes.get().map((node) => {
         if (node.type === objectType) {
            node.hidden = true;
         }
         return node;
      });
      data.nodes.update(nodesToHide);
   } else if (type === "edge") {
      const edgesToHide = data.edges.get().map((edge) => {
         if (edge.type === objectType) {
            edge.hidden = true;
         }
         return edge;
      });
      data.edges.update(edgesToHide);
   }
};

/**
 * Grays out the edges and nodes but the edges that are of the passed edge type
 * @param {string} edgeType - The type of edges to highlight
 */
export const HighlightEdges = (edgeType, highlightedObjs, data, edgeOptions) => {
   if (!highlightedObjs.current.some((obj) => obj.type === "node")) {
      const nodeItems = data.nodes.map((node) => {
         node.group = "inactive";
         node.label = " ";
         return node;
      });

      data.nodes.update(nodeItems);
   }

   const edgesToUpdate = data.edges.map((edge) => {
      if (edge.type === edgeType && highlightedObjs.current.some((obj) => obj === edge.id)) {
         edge.color = "rgba(200, 200, 200, 0.4)";
         edge.width = edgeOptions[edge.type].width;

         highlightedObjs.current = highlightedObjs.current.filter((obj) => obj.id !== edge.id);
      } else if (
         edge.type !== edgeType &&
         !highlightedObjs.current.some((obj) => obj.id === edge.id)
      ) {
         edge.color = "rgba(200, 200, 200, 0.4)";
         edge.width = edgeOptions[edge.type].width;
      } else if (
         edge.type === edgeType &&
         !highlightedObjs.current.some((obj) => obj.id === edge.id)
      ) {
         edge.color = edgeOptions[edge.type].color;
         edge.width = edgeOptions[edge.type].width * 3;

         highlightedObjs.current.push({ id: edge.id, type: "edge" });
      }

      return edge;
   });

   data.edges.update(edgesToUpdate);
};

/**
 * Grays out all edges and nodes that don't mach the node type
 * @param {string} nodeType - The type of nodes to highlight
 * @param {Object} highlightedObjs - useRef to keep track of highlighted nodes and edges
 * @param {Object} data - the visjs data object containing nodes and edges
 */
export const HighlightGroup = (nodeType, data, highlightedObjs) => {
   const updateNodes = data.nodes.map((node) => {
      if (node.type === nodeType && highlightedObjs.current.includes(node.id)) {
         node.group = "inactive";
         node.label = " ";

         highlightedObjs.current = highlightedObjs.current.filter((obj) => obj.id !== node.id);
      } else if (
         node.type !== nodeType &&
         !highlightedObjs.current.some((obj) => obj.id === node.id)
      ) {
         node.group = "inactive";
         node.label = " ";
      } else if (node.type === nodeType && !highlightedObjs.current.includes(node.id)) {
         if (node.group === "inactive") {
            node.group = node.type;
            if (node.attributes && "name" in node.attributes) node.label = node.attributes.name;
            else node.label = node.id;
         }

         highlightedObjs.current.push({ id: node.id, type: "node" });
      }

      return node;
   });

   if (!highlightedObjs.current.some((obj) => obj.type === "edge")) {
      const updateEdges = data.edges.map((edge) => {
         edge.color = "rgba(200, 200, 200, 0.5)";

         return edge;
      });

      data.edges.update(updateEdges);
   }

   data.nodes.update(updateNodes);
};

/**
 * Generates an array of highlighted nodes and focuses on a node
 * starting at the beginning of the array then moves up by one every function call
 */
export const Next = (glmNetwork, highlightedObjs, counter) => {
   // starting counter is -1 so that when adding one is 0 to start at index 0
   counter.value++;

   // if the counter matches the length of the array then the count starts back at 0
   if (counter.value === highlightedObjs.current.length) {
      counter.value = 0;
   }

   try {
      const objToFocus = highlightedObjs.current[counter.value];
      if (objToFocus.type === "edge") {
         edgeFocus(objToFocus, glmNetwork);
      } else {
         glmNetwork.focus(objToFocus.id, {
            scale: 3,
            animation: {
               duration: 750
            },
            easingFunction: "easeInQuad"
         });
      }
   } catch (error) {
      console.error(error);
      alert("There are no highlighted nodes to cycle through...");
   }
};

/**
 * Generates an array of highlighted nodes and focuses on a node
 * starting at the end of the array then moves down every function call
 */
export const Prev = (glmNetwork, highlightedObjs, counter) => {
   counter.value--;

   //if the counter ends up less than 0 the counter starts over at the end of the array
   if (counter.value < 0) {
      counter.value = highlightedObjs.current.length - 1;
   }

   try {
      const objToFocus = highlightedObjs.current[counter.value];
      if (objToFocus.type === "edge") {
         edgeFocus(objToFocus, glmNetwork);
      } else {
         glmNetwork.focus(objToFocus.id, {
            scale: 3,
            animation: {
               duration: 750
            },
            easingFunction: "easeInQuad"
         });
      }
   } catch {
      alert("There are no highlighted nodes to cycle through...");
   }
};

export const rotateCCW = (network, angle) => {
   for (const nodeID of network.body.nodeIndices) {
      const pos = network.getPosition(nodeID);

      const newX = pos.x * Math.cos(-angle) - pos.y * Math.sin(-angle);
      const newY = pos.x * Math.sin(-angle) + pos.y * Math.cos(-angle);

      network.moveNode(nodeID, newX.toFixed(0), newY.toFixed(0));
   }
};

export const rotateCW = (network, angle) => {
   for (const nodeID of network.body.nodeIndices) {
      const pos = network.getPosition(nodeID);

      const newX = pos.x * Math.cos(angle) - pos.y * Math.sin(angle);
      const newY = pos.x * Math.sin(angle) + pos.y * Math.cos(angle);

      network.moveNode(nodeID, newX.toFixed(0), newY.toFixed(0));
   }
};

// used to keep track of the amount of uploads
// will reset if graph component dismounts
export let currentUploadCounter = { value: 0 };

/**
 * Collects all the nodes and edges with their attributes and sets it to the data variable
 * @param {Object} dataFromFiles
 */
export const setGraphData = (
   graphData,
   dataFromFiles,
   nodeTypes,
   edgeTypes,
   objectTypeCount,
   GLIMPSE_OBJECT,
   theme,
   graphOptions,
   filteredAttributes
) => {
   /*
      acceptable keys object and its attributes ex:
      {
         ["name" || "objectType"]: "load",
         ...
         "attributes": {
            ["name" || "id"]: "load_123",
            ...
         }
      }
   */
   const keys = ["id", "objectType", "name"];
   const files = Object.keys(dataFromFiles).map((file) => dataFromFiles[file]);
   const newNodes = [];
   const newEdges = [];

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

         if (nodeTypes.length > 0 && nodeTypes.includes(objectType)) {
            if (!(objectType in filteredAttributes)) filteredAttributes[objectType] = {};

            Object.keys(attributes).forEach((key) => {
               if (!(key in filteredAttributes)) filteredAttributes[objectType][key] = true;
            });

            if ("x" in attributes && "y" in attributes) {
               objectTypeCount.nodes[objectType]++;

               if (!("elemetType" in obj))
                  GLIMPSE_OBJECT.objects.push({ ...obj, elementType: "node" });
               else GLIMPSE_OBJECT.objects.push(obj);

               if (!("color" in theme.groups[objectType]))
                  theme.groups[objectType].color = getRandomColor();

               const node = {
                  id:
                     currentUploadCounter.value > 0
                        ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                        : nodeID,
                  label: "name" in attributes ? attributes.name : nodeID,
                  elementType: "node",
                  attributes: attributes,
                  type: objectType,
                  group: objectType,
                  title: `Object Type: ${objectType}\n${getTitle(attributes)}`,
                  x: attributes.x.length > 0 ? parseInt(attributes.x, 10) : undefined,
                  y: attributes.y.length > 0 ? parseInt(attributes.y, 10) : undefined
               };

               node.fixed = node.x && node.y ? true : false;
               node.physcis = node.x && node.y ? false : true;

               if (node.x !== undefined && node.x > greatest.x) greatest.x = node.x;
               if (node.y !== undefined && node.y > greatest.y) greatest.y = node.y;

               newNodes.push(node);

               continue;
            }

            if ("level" in attributes) {
               if (!graphOptions.layout.hierarchical.enabled)
                  graphOptions.layout.hierarchical.enabled = true;

               if (objectType in objectTypeCount.nodes) objectTypeCount.nodes[objectType]++;
               else objectTypeCount.nodes[objectType] = 1;

               if (!("elementType" in obj))
                  GLIMPSE_OBJECT.objects.push({ ...obj, elementType: "node" });
               else GLIMPSE_OBJECT.objects.push(obj);

               if (!("color" in theme.groups[objectType]))
                  theme.groups[objectType].color = getRandomColor();

               newNodes.push({
                  id:
                     currentUploadCounter.value > 0
                        ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                        : nodeID,
                  label: "label" in theme.groups[objectType] ? undefined : nodeID,
                  elementType: "node",
                  level: attributes.level,
                  attributes: attributes,
                  type: objectType,
                  group: objectType,
                  title: `Object Type: ${objectType}\n${getTitle(attributes)}`
               });

               continue;
            }

            objectTypeCount.nodes[objectType]++;

            obj = renameKeys({ name: "objectType" }, obj);
            obj.attributes = renameKeys({ name: "id" }, obj.attributes);

            if (!("elementType" in obj))
               GLIMPSE_OBJECT.objects.push({ ...obj, elementType: "node" });
            else GLIMPSE_OBJECT.objects.push(obj);

            if (!("color" in theme.groups[objectType]))
               theme.groups[objectType].color = getRandomColor();

            newNodes.push({
               id:
                  currentUploadCounter.value > 0
                     ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                     : nodeID,
               label: "name" in attributes ? attributes.name : nodeID,
               elementType: "node",
               communityID: currentUploadCounter.value,
               attributes: attributes,
               type: objectType,
               group: objectType,
               title: `Object Type: ${objectType}\n${getTitle(attributes)}`
            });

            continue;
         } else if ("elementType" in obj && obj.elementType === "node") {
            if (!(objectType in filteredAttributes)) filteredAttributes[objectType] = {};

            Object.keys(attributes).forEach((key) => {
               if (!(key in filteredAttributes)) filteredAttributes[objectType][key] = true;
            });

            if (!(objectType in theme.groups)) {
               theme.groups[objectType] = {
                  color: getRandomColor(),
                  size: 10,
                  shape: "dot"
               };
            }

            if (!nodeTypes.includes(objectType)) nodeTypes.push(objectType);

            if (objectType in objectTypeCount.nodes) objectTypeCount.nodes[objectType]++;
            else objectTypeCount.nodes[objectType] = 1;

            GLIMPSE_OBJECT.objects.push(obj);

            newNodes.push({
               id:
                  currentUploadCounter.value > 0
                     ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                     : nodeID,
               label: "name" in attributes ? attributes.name : nodeID,
               elementType: "node",
               communityID: currentUploadCounter.value,
               level: "level" in attributes ? attributes.level : undefined,
               attributes: attributes,
               type: objectType,
               group: objectType,
               title: `Object Type: ${objectType}\n${getTitle(attributes)}`
            });
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

         if (nodeTypes.includes(objectType) && "parent" in attributes) {
            const nodeID =
               currentUploadCounter.value > 0
                  ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                  : attributes[nameForObjID];
            const parent =
               currentUploadCounter.value > 0
                  ? `${attributes.parent}-${currentUploadCounter.value}`
                  : attributes.parent;

            objectTypeCount.edges.parentChild++;

            GLIMPSE_OBJECT.objects.push({
               objectType: "parentChild",
               elementType: "edge",
               attributes: {
                  id: `${parent}-${nodeID}`,
                  from: parent,
                  to: nodeID
               }
            });

            newEdges.push({
               id: `${parent}-${nodeID}`,
               from: parent,
               to: nodeID,
               elementType: "edge",
               type: "parentChild",
               width: 4,
               attributes: { to: parent, from: nodeID },
               title: getTitle({ objectType: "parentChild", to: parent, from: nodeID }),
               color: { inherit: true }
            });

            continue;
         } else if (edgeTypes.includes(objectType)) {
            if (!(objectType in filteredAttributes)) filteredAttributes[objectType] = {};

            Object.keys(attributes).forEach((key) => {
               if (!(key in filteredAttributes)) filteredAttributes[objectType][key] = true;
            });

            const edgeFrom =
               currentUploadCounter.value > 0
                  ? `${attributes.from}-${currentUploadCounter.value}`
                  : attributes.from;
            const edgeTo =
               currentUploadCounter.value > 0
                  ? `${attributes.to}-${currentUploadCounter.value}`
                  : attributes.to;
            const edgeID =
               currentUploadCounter.value > 0
                  ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                  : attributes[nameForObjID];

            objectTypeCount.edges[objectType]++;

            obj = renameKeys({ name: "objectType" }, obj);
            obj.attributes = renameKeys({ name: "id" }, obj.attributes);

            GLIMPSE_OBJECT.objects.push({ ...obj, elementType: "edge" });

            newEdges.push({
               id: edgeID,
               from: edgeFrom,
               to: edgeTo,
               elementType: "edge",
               type: objectType,
               attributes: attributes,
               ...theme.edgeOptions[objectType],
               title: `Object Type: ${objectType}\n${getTitle(attributes)}`
               // length: "length" in attributes ? attributes.length : undefined,
            });

            continue;
         } else if ("elementType" in obj && obj.elementType === "edge") {
            if (!(objectType in filteredAttributes)) filteredAttributes[objectType] = {};

            Object.keys(attributes).forEach((key) => {
               if (!(key in filteredAttributes)) filteredAttributes[objectType][key] = true;
            });

            const edgeFrom =
               currentUploadCounter.value > 0
                  ? `${attributes.from}-${currentUploadCounter.value}`
                  : attributes.from;
            const edgeTo =
               currentUploadCounter.value > 0
                  ? `${attributes.to}-${currentUploadCounter.value}`
                  : attributes.to;
            const edgeID =
               currentUploadCounter.value > 0
                  ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                  : attributes[nameForObjID];

            if (!(objectType in theme.edgeOptions))
               theme.edgeOptions[objectType] = { color: getRandomColor(), width: 2 };

            if (objectType in objectTypeCount.edges) objectTypeCount.edges[objectType]++;
            else objectTypeCount.edges[objectType] = 1;

            if (!edgeTypes.includes(objectType)) edgeTypes.push(objectType);

            GLIMPSE_OBJECT.objects.push(obj);

            newEdges.push({
               id: edgeID,
               from: edgeFrom,
               to: edgeTo,
               elementType: "edge",
               type: objectType,
               // length: "length" in attributes ? attributes.length : undefined,
               attributes: attributes,
               ...theme.edgeOptions[objectType],
               title: `Object Type: ${objectType}\n${getTitle(attributes)}`
            });
         }
      }
   }

   if (!("inactive" in theme.groups)) {
      theme.groups.inactive = {
         color: "rgba(200, 200, 200, 0.4)",
         shape: "dot"
      };
   }

   if (newNodes.every((node) => node.attributes.level !== undefined)) {
      graphOptions.layout.hierarchical.enabled = true;
   }

   if (greatest.x > 0 && greatest.y > 0) {
      graphData.nodes.add(
         newNodes.map((node) => {
            if (node.x !== undefined && node.y !== undefined) {
               node.x -= greatest.x;
               node.y -= greatest.y;
            }
            return node;
         })
      );
   } else graphData.nodes.add(newNodes);

   graphData.edges.add(newEdges);
   currentUploadCounter.value++;
};
