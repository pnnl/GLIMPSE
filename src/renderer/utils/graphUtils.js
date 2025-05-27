/**
 * Generates a random color in hexadecimal format.
 * @returns A hexadecimal color
 */
export const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';

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

  return title.join('\n');
};

export const getHtmlTitle = (titleObj) => {
  const container = document.createElement('div');

  Object.entries(titleObj).forEach(([key, value]) => {
    const row = document.createElement('div');
    row.style.marginBottom = '4px';
    row.innerHTML = `<strong>${key}:</strong> ${value}`;
    container.appendChild(row);
  });

  return container;
};

export const getHtmlLabel = (id, attributes) => {
  return `\t<b>${id}</b>\n\n` + getTitle(attributes);
};

/**
 * Updates uploaded data with any changes.
 * Then downloads the data back to the user's computer
 */
export const Export = (data, isGlm, dataToVis) => {
  if (isGlm) {
    Object.keys(dataToVis).forEach((file) => {
      dataToVis[file].objects.forEach((obj) => {
        if ('attributes' in obj && data.nodes.getIds().includes(obj.attributes.name)) {
          obj.attributes = data.nodes.get(obj.attributes.name).attributes;
        }
      });
    });

    window.glimpseAPI.json2glm(JSON.stringify(dataToVis));
  } else {
    alert('Export feature available for .glm uploads for now');
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
      duration: 1500,
      easing: 'easeInOutQuart'
    }
  };

  if (typeof node.communityID !== 'number' && network.clustering.isCluster(node.communityID)) {
    network.focus(node.communityID, options);
    return;
  } else if (
    typeof node.communityID === 'number' &&
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
  const options = {
    scale: 3,
    locked: false,
    animation: {
      duration: 1500,
      easing: 'easeInOytQuart'
    }
  };

  if (network.clustering.findNode(edge.from).length > 1) {
    console.log(network.body.nodes[edge.from].options.communityID);
    nodeFocus(
      { id: edge.from, communityID: network.body.nodes[edge.from].options.communityID },
      network
    );

    return null;
  }

  const clusteredEdges = network.clustering.getClusteredEdges(edgeID);
  if (clusteredEdges.length > 1) {
    edgeID = clusteredEdges[0];
  }

  const x_1 = network.body.edges[edgeID].from.x;
  const y_1 = network.body.edges[edgeID].from.y;
  const x_2 = network.body.edges[edgeID].to.x;
  const y_2 = network.body.edges[edgeID].to.y;

  const midPoint = { x: (x_1 + x_2) / 2, y: (y_1 + y_2) / 2 };

  network.moveTo({ position: midPoint, ...options });
};

/**
 * Create nodes and edges based on the object type being visualized in the main network
 * @param {Object} typeCounts - containes the counts of node and edge types
 * @returns {Object} an object containing the nodes and edges to be visualized in the legend network
 */
export const setLegendData = (typeCounts, theme, edgeOptions, legendData) => {
  legendData.nodes.clear();
  legendData.edges.clear();

  const currentNodeTypes = [];
  const currentEdgeTypes = [];

  Object.entries(typeCounts.nodes).forEach(([type, count], i) => {
    if (count > 0) currentNodeTypes.push(type);
  });

  Object.entries(typeCounts.edges).forEach(([type, count], i) => {
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
          title: 'Double Click to Highlight !',
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
        shape: 'dot',
        groups: nodeType,
        title: 'Double Click to Highlight !',
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
        title: 'Double Click to Highlight !',
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
      shape: 'dot',
      group: nodeType,
      title: 'Double Click to Highlight !',
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
      color: '#000'
    });

    legendData.nodes.add({
      id: `${type}:${index + 1}`,
      x: farthest_x === current_x ? 250 : farthest_x === 0 ? current_x : farthest_x,
      y: current_y,
      fixed: true,
      physcis: false,
      color: '#000'
    });

    if (type in edgeOptions) {
      legendData.edges.add({
        id: type,
        from: `${type}:${index}`,
        to: `${type}:${index + 1}`,
        title: 'Double Click to Highlight !',
        label: `${type} [${typeCounts.edges[type]}]`,
        width: 8,
        color: edgeOptions[type].color
      });
    } else {
      legendData.edges.add({
        id: type,
        from: `${type}:${index}`,
        to: `${type}:${index + 1}`,
        label: `${type} [${typeCounts.edges[type]}]`,
        title: 'Double Click to Highlight !',
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

export const showAttributes = (show, data) => {
  if (!show) {
    data.nodes.update(
      data.nodes.map((node) => {
        node.label = node.id;
        return node;
      })
    );

    data.edges.update(
      data.edges.map((edge) => {
        edge.label = ' ';
        return edge;
      })
    );
  } else {
    data.nodes.update(
      data.nodes.map((node) => {
        node.label = getHtmlLabel(node.id, node.attributes);
        return node;
      })
    );

    data.edges.update(
      data.edges.map((edge) => {
        edge.label = getHtmlLabel(edge.id, edge.attributes);
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
  if (type === 'node') {
    const nodesToHide = data.nodes.get().map((node) => {
      if (node.type === objectType) {
        node.hidden = true;
      }
      return node;
    });
    data.nodes.update(nodesToHide);
  } else if (type === 'edge') {
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
export const HighlightEdges = (edgeType, highlightedNodes, data, edgeOptions, highlightedEdges) => {
  if (highlightedNodes.current.length === 0) {
    const nodeItems = data.nodes.map((node) => {
      node.group = 'inactive';
      node.label = ' ';
      return node;
    });

    data.nodes.update(nodeItems);
  }

  const edgesToUpdate = data.edges.map((edge) => {
    if (edge.type === edgeType && highlightedEdges.current.includes(edge.id)) {
      edge.color = 'rgba(200, 200, 200, 0.4)';
      edge.width = edgeOptions[edge.type].width;

      highlightedEdges.current = highlightedEdges.current.filter((edgeid) => edgeid !== edge.id);
    } else if (edge.type !== edgeType && !highlightedEdges.current.includes(edge.id)) {
      edge.color = 'rgba(200, 200, 200, 0.4)';
      edge.width = edgeOptions[edge.type].width;
    } else if (edge.type === edgeType && !highlightedEdges.current.includes(edge.id)) {
      edge.color = edgeOptions[edge.type].color;
      edge.width = edgeOptions[edge.type].width * 3;

      highlightedEdges.current.push(edge.id);
    }

    return edge;
  });

  data.edges.update(edgesToUpdate);
};

/**
 * Grays out all edges and nodes that dont mach the node type
 * @param {string} nodeType - The type of nodes to highlight
 */
export const HighlightGroup = (nodeType, data, highlightedNodes, highlightedEdges) => {
  const updateNodes = data.nodes.map((node) => {
    if (node.type === nodeType && highlightedNodes.current.includes(node.id)) {
      node.group = 'inactive';
      node.label = ' ';

      highlightedNodes.current = highlightedNodes.current.filter((nodeid) => nodeid !== node.id);
    } else if (node.type !== nodeType && !highlightedNodes.current.includes(node.id)) {
      node.group = 'inactive';
      node.label = ' ';
    } else if (node.type === nodeType && !highlightedNodes.current.includes(node.id)) {
      if (node.group === 'inactive') {
        node.group = node.type;
        node.label = node.id;
      }

      highlightedNodes.current.push(node.id);
    }

    return node;
  });

  if (highlightedEdges.current.length === 0) {
    const updateEdges = data.edges.map((edge) => {
      edge.color = 'rgba(200, 200, 200, 0.5)';

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
export const Next = (glmNetwork, highlightedNodes, counter) => {
  // starting counter is -1 so that when adding one is 0 to start at index 0
  counter.value++;

  // if the counter matches the length of the array then the count starts back at 0
  if (counter.value === highlightedNodes.current.length) {
    counter.value = 0;
  }

  try {
    glmNetwork.focus(highlightedNodes.current[counter.value], {
      scale: 3,
      animation: {
        duration: 750
      },
      easingFunction: 'easeInQuad'
    });
  } catch {
    alert('There are no highlighted nodes to cycle through...');
  }
};

/**
 * Generates an array of highlighted nodes and focuses on a node
 * starting at the end of the array then moves down every function call
 */
export const Prev = (glmNetwork, highlightedNodes, counter) => {
  counter.value--;

  //if the counter ends up less than 0 the counter starts over at the end of the array
  if (counter.value < 0) {
    counter.value = highlightedNodes.current.length - 1;
  }

  try {
    glmNetwork.focus(highlightedNodes.current[counter.value], {
      scale: 3,
      animation: {
        duration: 750
      },
      easingFunction: 'easeInQuad'
    });
  } catch {
    alert('There are no highlighted nodes to cycle through...');
  }
};

export const rotateCCW = (network, angle) => {
  // loop through the node IDs of the currently drawn nodes in the canvas
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
  data,
  dataFromFiles,
  nodeTypes,
  edgeTypes,
  objectTypeCount,
  GLIMPSE_OBJECT,
  theme,
  edgeOptions,
  graphOptions
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
  const keys = ['id', 'objectType', 'name'];
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

      if (nodeTypes.includes(objectType)) {
        if ('x' in attributes && 'y' in attributes) {
          objectTypeCount.nodes[objectType]++;

          if (!('elemetType' in obj)) GLIMPSE_OBJECT.objects.push({ ...obj, elementType: 'node' });
          else GLIMPSE_OBJECT.objects.push(obj);

          if (!('color' in theme.groups[objectType]))
            theme.groups[objectType].color = getRandomColor();

          newNodes.push({
            id:
              currentUploadCounter.value > 0
                ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                : nodeID,
            label: 'label' in theme.groups[objectType] ? undefined : nodeID,
            elementType: 'node',
            attributes: attributes,
            type: objectType,
            group: objectType,
            title: getHtmlTitle({ ObjectType: objectType, ...attributes }),
            x: parseInt(attributes.x, 10),
            y: parseInt(attributes.y, 10)
          });

          continue;
        } else if ('level' in attributes) {
          if (!graphOptions.layout.hierarchical.enabled)
            graphOptions.layout.hierarchical.enabled = true;

          if (objectType in objectTypeCount.nodes) objectTypeCount.nodes[objectType]++;
          else objectTypeCount.nodes[objectType] = 1;

          if (!('elementType' in obj)) GLIMPSE_OBJECT.objects.push({ ...obj, elementType: 'node' });
          else GLIMPSE_OBJECT.objects.push(obj);

          if (!('color' in theme.groups[objectType]))
            theme.groups[objectType].color = getRandomColor();

          newNodes.push({
            id:
              currentUploadCounter.value > 0
                ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
                : nodeID,
            label: 'label' in theme.groups[objectType] ? undefined : nodeID,
            elementType: 'node',
            level: attributes.level,
            attributes: attributes,
            type: objectType,
            group: objectType,
            title: getHtmlTitle({ ObjectType: objectType, ...attributes })
          });

          continue;
        }

        objectTypeCount.nodes[objectType]++;

        obj = renameKeys({ name: 'objectType' }, obj);
        obj.attributes = renameKeys({ name: 'id' }, obj.attributes);

        if (!('elementType' in obj)) GLIMPSE_OBJECT.objects.push({ ...obj, elementType: 'node' });
        else GLIMPSE_OBJECT.objects.push(obj);

        if (!('color' in theme.groups[objectType]))
          theme.groups[objectType].color = getRandomColor();

        newNodes.push({
          id:
            currentUploadCounter.value > 0
              ? `${attributes[nameForObjID]}-${currentUploadCounter.value}`
              : nodeID,
          label: 'label' in theme.groups[objectType] ? undefined : nodeID,
          elementType: 'node',
          communityID: currentUploadCounter.value,
          attributes: attributes,
          type: objectType,
          group: objectType,
          title: getHtmlTitle({ ObjectType: objectType, ...attributes })
        });

        continue;
      } else if ('elementType' in obj && obj.elementType === 'node') {
        if (!(objectType in theme.groups)) {
          theme.groups[objectType] = {
            color: getRandomColor(),
            size: 10,
            shape: 'dot'
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
          label: 'label' in theme.groups[objectType] ? undefined : nodeID,
          elementType: 'node',
          communityID: currentUploadCounter.value,
          level: 'level' in attributes ? attributes.level : undefined,
          attributes: attributes,
          type: objectType,
          group: objectType,
          title: getHtmlTitle({ ObjectType: objectType, ...attributes })
        });
      }
    }
  }

  // get edges
  for (const file of files) {
    for (let obj of file.objects) {
      const attributes = obj.attributes;
      const nameForObjType = keys.find((key) => Object.keys(obj).includes(key));
      const edgeType = obj[nameForObjType];
      const nameForObjID = keys.find((key) => Object.keys(attributes).includes(key));

      if (nodeTypes.includes(edgeType) && 'parent' in attributes) {
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
          objectType: 'parentChild',
          elementType: 'edge',
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
          elementType: 'edge',
          type: 'parentChild',
          width: 4,
          attributes: { to: parent, from: nodeID },
          title: getHtmlTitle({ objectType: 'parentChild', to: parent, from: nodeID }),
          color: { inherit: true }
        });

        continue;
      } else if (edgeTypes.includes(edgeType)) {
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

        objectTypeCount.edges[edgeType]++;

        obj = renameKeys({ name: 'objectType' }, obj);
        obj.attributes = renameKeys({ name: 'id' }, obj.attributes);

        GLIMPSE_OBJECT.objects.push({ ...obj, elementType: 'edge' });

        if (edgeType === 'switch' && attributes.status === 'OPEN') {
          edgeOptions[edgeType].arrows = {
            middle: {
              enabled: true,
              type: 'image',
              imageWidth: 32,
              imageHeight: 32,
              src: './imgs/switch-open.svg'
            }
          };
        } else if (edgeType === 'switch' && attributes.status === 'CLOSED') {
          edgeOptions[edgeType].arrows = {
            middle: {
              enabled: true,
              type: 'image',
              imageWidth: 32,
              imageHeight: 32,
              src: './imgs/switch-closed.svg'
            }
          };
        }

        newEdges.push({
          id: edgeID,
          from: edgeFrom,
          to: edgeTo,
          elementType: 'edge',
          type: edgeType,
          attributes: attributes,
          title: getHtmlTitle({ ObjectType: edgeType, ...attributes }),
          ...edgeOptions[edgeType]
        });

        continue;
      } else if ('elementType' in obj && obj.elementType === 'edge') {
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

        if (!(edgeType in edgeOptions))
          edgeOptions[edgeType] = { color: getRandomColor(), width: 2 };

        if (edgeType in objectTypeCount.edges) objectTypeCount.edges[edgeType]++;
        else objectTypeCount.edges[edgeType] = 1;

        GLIMPSE_OBJECT.objects.push(obj);

        newEdges.push({
          id: edgeID,
          from: edgeFrom,
          to: edgeTo,
          elementType: 'edge',
          type: edgeType,
          attributes: attributes,
          title: getHtmlTitle({ ObjectType: edgeType, ...attributes }),
          ...edgeOptions[edgeType]
        });
      }
    }
  }

  data.nodes.add(newNodes);
  data.edges.add(newEdges);
  currentUploadCounter.value++;
};
