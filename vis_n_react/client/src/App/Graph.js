import React, {useEffect, useRef} from 'react';
import "../styles/Graph.css";
import {Network} from 'vis-network';
import { DataSet } from 'vis-data';
import SearchBar from './SearchBar';
import axios from 'axios';
import NodePopup from './NodePopup';
import '../styles/vis-network.css';
import Legend from './Legend';
import EdgeContextMenu from './EdgeContextMenu';
// import options from './config/graphOptions.js';
import appConfig from '../appConfig/appConfig';
import { nodeOptions, edgeOptions } from './config/objectOptions';

const options = appConfig.graphOptions;

const data = {
  nodes: new DataSet(),
  edges: new DataSet()
};

let glmNetwork;
let counter = -1;
const objectTypeCount = {
  "nodes": {
    "load": 0,
    "node": 0,
    "meter": 0,
    "inverter": 0,
    "inverter_dyn": 0,
    "diesel_dg": 0,
    "capacitor": 0,
    "triplex_load": 0, 
    "triplex_node": 0,
    "triplex_meter": 0,
    "substation": 0
  },
  "edges": {
    "overhead_line": 0,
    "switch": 0, 
    "underground_line": 0,
    "series_reactor": 0,
    "triplex_line": 0,
    "regulator": 0,
    "transformer": 0
  }
};

//These types are what are considered edges
const edgeTypes = [
  "overhead_line",
  "switch",
  "underground_line",
  "series_reactor",
  "triplex_line",
  "regulator",
  "transformer",
  "mapping",
  "communication",
  "microgrid_connection"
];

//These types are recognized as nodes by electrical engineers.
const nodeTypes = [
  "load", 
  "triplex_load",
  "capacitor", 
  "node", 
  "triplex_node",
  "substation", 
  "meter", 
  "triplex_meter", 
  "inverter_dyn", 
  "inverter", 
  "diesel_dg", 
  "communication_node", 
  "microgrid_node"
];

//These edges or connections are between parent and child nodes
const parent_child_edge_types = [
  "capacitor", 
  "triplex_meter", 
  "triplex_load", 
  "meter"
];

//This functions turns attributes of a node or edge to a string tile that may be displayed
const getTitle = (attributes) => {

  let str = "";

  for (let [key, val] of Object.entries(attributes))
  {
    str += key + ": " + val + "\n";
  }
  
  return str;
}

//This function will retreve all nodes and edges from a glm file that has be converted to json
const getGraphData= (dataFiles) => {

  const files = [];

  //this loop splits the json into each file name and their data to an array
  //each key of the json is the file name along with the file's data
  for (let file in dataFiles)
  {
    files.push(dataFiles[file]);
  }

  //For each file gather all of the nodes that matches the types
  for (let file of files)
  {
    let objs = file.objects;
  
    for (let obj of objs)
    {
      const objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
      const attributes = obj.attributes;
      if (nodeTypes.includes(objectType))
      {
        const nodeID = attributes.name;
        data.nodes.add({
          "id": nodeID,
          "label": nodeID,
          "attributes": attributes,
          "group": nodeOptions.get(objectType).group,
          "title": "Object Type: " + objectType + "\n" + getTitle(attributes),
          "x": attributes.x !== undefined ? parseInt(attributes.x, 10) : undefined,
          "y": attributes.y !== undefined ? parseInt(attributes.y, 10) : undefined
        });

        objectTypeCount.nodes[objectType]++;
      }
    }
  }

  for (let file of files)
  {
    
    const objs = file.objects;
  
    for (let obj of objs)
    {
      const objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
      const attributes = obj.attributes;
      if (edgeTypes.includes(objectType))
      {
        const edgeFrom = attributes.from.includes(":") ? attributes.from.split(":")[1] : attributes.from;
        const edgeTo = attributes.to.includes(":") ? attributes.to.split(":")[1] : attributes.to;
        const edgeID = obj.name.includes(":") ? obj.name : objectType + ":" + attributes.name;
        
        data.edges.add({
          "from": edgeFrom,
          "to": edgeTo,
          "id": edgeID,
          "color": edgeOptions.get(objectType).color,
          "width": edgeOptions.get(objectType).width,
          "hidden": edgeOptions.get(objectType).hidden,
          "title": "Object Type: " + objectType + "\n" + getTitle(attributes)});
        
        objectTypeCount.edges[objectType]++;
      }
      else if (parent_child_edge_types.includes(objectType))
      {
        const nodeID = attributes.name;
        const parent = attributes.parent;
  
        if(parent !== undefined)
        {
          data.edges.add({
            "from": parent,
            "to": nodeID,
            "color": {"inherit": true}
          });
        }
      }
      else if(nodeTypes.includes(objectType))
      {
        const nodeID = attributes.name;
        const parent = attributes.parent;
        
        if(parent !== undefined)
        {
          data.edges.add({
            "from": parent,
            "to": nodeID,
            "color": {"inherit": true}
          });
        }
      }
    }
  }
}

const NodeFocus = (nodeID) => {
    
  const options = {
    "scale": 3,
    "locked": true,
    "animation": {
      "duration": 1500,
      "easing": "easeInOutQuart"
    }
  };

  glmNetwork.focus(nodeID, options)
}

const Reset = () => {

  const nodesResetMap = data.nodes.map((node) => {

    delete node.color;
    delete node.size;
    node.hidden = false;

    return node;

  });
  
  const edgeItems = data.edges.map((e) => {
    if(e.width === 8)
    {
      e.width = 2;
      e.hidden = false;
      return e;
    }
    else if(edgeTypes.includes(e.id.split(":")[0]))
    {
      e.color = edgeOptions.get(e.id.split(":")[0]).color;
      e.width = edgeOptions.get(e.id.split(":")[0]).width;
      e.hidden = false;
      return e;
    }
    else
    {
      e.color = {inherit: true};
      e.hidden = false;
      return e;
    }
  });

  data.nodes.update(nodesResetMap);
  data.edges.update(edgeItems);
  glmNetwork.fit();
  counter = 0;
}

const TogglePhysics = (toggle) => {
    
  if(toggle)
  {
    glmNetwork.setOptions({physics: {enabled: true}})
  }
  else
  {
    glmNetwork.setOptions({physics: {enabled: false}})
  }

}

const Prev = () => {
  
  const options = {
    "scale": 3,
    "locked": true,
    "animation": {
      "duration": 1500,
      "easing": "easeInOutQuart"
    }
  };

  const prev = data.nodes.get({
    filter: (n) => {
      return (n.size === 12);
    }
  });
  
  counter--;
  if(counter < 0)
  {
    counter = prev.length - 1;
  }
  
  try{
    glmNetwork.focus(prev[counter].id, options)
  } catch{
    alert("There are no highlighted nodes to cycle through...");
  }
}

const Next = () => {

  const options = {
    "scale": 3,
    "locked": true,
    "animation": {
      "duration": 1500,
      "easing": "easeInOutQuart"
    }
  };

  const next = data.nodes.get({
    filter: (n) => {
      return (n.size === 12);
    }
  });

  counter++;
  if(counter >= next.length)
  {
    counter = 0;
    try{
      glmNetwork.focus(next[counter].id, options)
    } catch{
      alert("There are no highlighted nodes to cycle through...");
    }
  }
  else
  {
    try{
      glmNetwork.focus(next[counter].id, options)
    } catch{
      alert("There are no highlighted nodes to cycle through...");
    }
  }
}

const HighlightGroup = (nodeType) => {

  const nodesMap = data.nodes.map((node) => {

    if (node.group === nodeType || node.size === 12)
    {
      delete node.color;
      node.size = 12;
      return node;
    }
    else if (node.group === nodeType && node.size === 12)
    {
      node.size = 1;
      node.color = "lightgrey";
      return node;
    }
  
    node.size = 1;
    node.color = "lightgrey";
    return node;
  });
  
  const edgesMap = data.edges.map((edge) => {

    if(edge.width !== 8)
    {
      edge.color = 'lightgrey';
    }

    return edge;
    
  });

  data.nodes.update(nodesMap);
  data.edges.update(edgesMap);
}

const HighlightEdges = (edgeType) => {
  
  const nodeItems = data.nodes.map((n) => {
    if (n.size !== 12)
    {
      n.color = "lightgrey";
      n.size = 1;

      return n;
    }

    return n;
  });
  
  const edgeItems = data.edges.map(( edge ) => {
    if( edge.id.split(":")[ 0 ] === edgeType )
    {
      edge.color = edgeOptions.get( edgeType ).color;
      edge.width = 8;
      return edge;
    }
    else if( edge.width !== 8)
    {
      edge.color = "lightgrey";
      edge.width = 0.15;
      return edge;
    }

    return edge;
  });
  
  data.nodes.update( nodeItems );
  data.edges.update( edgeItems );
}

/* ------------------------ Component ------------------------ */
const Graph = ({ visFiles }) => {
  
  const jsonFromGlm = visFiles;
  getGraphData( jsonFromGlm );

  console.log( "Number of Nodes: " + data.nodes.length );
  console.log( "Number of Edges: " + data.edges.length );

  const closePopUp = () => {
    
    document.getElementById( "node-saveButton" ).onclick = null;
    document.getElementById( "node-closeButton" ).onclick = null;
    document.getElementById( "node-popUp" ).style.display = "none";

  }
  
  const saveEdits = ( selectedNode ) => {
    
    selectedNode.title = getTitle( selectedNode.attributes );
    data.nodes.update( selectedNode );
    closePopUp();
    
  }

  const Export = () => {

    Object.keys( jsonFromGlm ).forEach(( file ) => {
      
      jsonFromGlm[ file ][ 'objects' ].forEach(( object ) => {

        const objType = object.name.includes( ":" ) ? object.name.split( ":" )[ 0 ] : object.name;

        if ( nodeTypes.includes( objType ) )
        {
          const newNodeAttributes = data.nodes.get( object.attributes.name ).attributes;

          object.attributes = newNodeAttributes;
        }
        
      });

    });

    const axios_instance = axios.create({
      "baseURL": 'http://localhost:3500',
      "timeout": 20000,
      "headers": {'Content-Type': 'application/json'}
    });

    axios_instance.post("/jsontoglm", jsonFromGlm, { responseType: 'blob' })
      .then(( { data: blob } ) => {
        const link = document.createElement( 'a' );
        const url = URL.createObjectURL( blob ) ;
        console.log( url );
        link.href = url;
        link.download = 'glmOutput.zip';
        link.click();
      })
      .catch(( err ) => console.log( err ))
  }

  const addOverlay = ( overlayData ) => {

    getGraphData(overlayData);

  }

  // Update current nodes with update JSON string
  const updateData = ( updateObj ) => {

    console.log(updateObj);
    
    if(updateObj.type === "edges")
    {
      let edge = data.edges.get(updateObj.id);
      edge.hidden = updateObj.styles.hidden;
      edge.width = updateObj.styles.width;

      data.edges.update(edge);
    }
    else
    {
      let node = data.nodes.get(updateObj.id);
      node.hidden = updateObj.styles.hidden;

      if( updateObj.styles.sizeOperation === 'subtract')
      {
        node.size = options.nodes.size;
        node.size -= updateObj.styles.by;
      }
      else
      {
        node.size = options.nodes.size;
        node.size += updateObj.styles.by;
      }

      data.nodes.update(node);
    }
  }

  let setCurrentNode;
  const onChildMount = (childSetFunc) => {
    setCurrentNode = childSetFunc;
  }

  let contextMenuData;
  let setContextMenuData;
  const onContextMenuChildMount = (contextMenuDataState, setContextMenuDataState) => {
    contextMenuData = contextMenuDataState;
    setContextMenuData = setContextMenuDataState;
  }

  const hideEdge = (edgeID) =>
  {
    const edgeToHide = data.edges.get().map( e => {
      if(e.id === edgeID)
      {
        e.hidden = true;
      }

      return e;
    })

    data.edges.update(edgeToHide);
  }
  
  const hideEdgeType = (edgeType) => {
    const edgesToHide = data.edges.get().map(e => {

      if(e.id.split(":")[0] === edgeType)
      {
        e.hidden = true;
      }

      return e;
    })

    data.edges.update(edgesToHide);
  }
  
  const handleContextmenu = (e) => {
    e.preventDefault();
    
    setContextMenuData( contextMenuData !== null ? {
      ...contextMenuData,
        "mouseX": e.pageX + 2,
        "mouseY": e.pageY + 6,
      } : null
    );
  }

  const hideObjects = (objectType, type) => {

    if (type === "node")
    {
      const nodesToHide = data.nodes.get().map( node => {

        if (node.group === objectType)
        {
          node.hidden = true;
        }
        
        return node;
      })

      data.nodes.update(nodesToHide);
    }
    else if (type === "edge") 
    {
      const edgesToHide = data.edges.get().map( edge => {

        if (edge.id.split(":")[0] === objectType)
        {
          edge.hidden = true;
        }
        
        return edge;
      })

      data.edges.update(edgesToHide);
    }
  }

  const container = useRef(null);
  useEffect(() => {

    if(data.nodes.get()[0].x && data.nodes.get()[0].y)
    {
      document.getElementById("circularProgress").style.display = "none";
      glmNetwork = new Network(container.current, data, options);
      glmNetwork.setOptions({physics: {enabled: false}})
    }
    else
    {
      options.physics.stabilization.enabled = true;
      glmNetwork = new Network(container.current, data, options);

      glmNetwork.on("stabilizationProgress", (params) => {
        
        const maxWidth = 360;
        const minWidth = 1;
        const widthFactor = params.iterations / params.total;
        const width = Math.max(minWidth, maxWidth * widthFactor);
        document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 "+ width +"deg, #333 0deg)";
        document.getElementById("progressValue").innerText = Math.round(widthFactor * 100) + "%";
      
      });
      
      glmNetwork.once("stabilizationIterationsDone", () => {

        document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 360deg, #333 0deg)";
        document.getElementById("progressValue").innerText = "100%";
        document.getElementById("circularProgress").style.opacity = 0.7;
        
        glmNetwork.setOptions({physics: {enabled: false}})

        setTimeout(() => {
          document.getElementById("circularProgress").style.display = "none";
        }, 500);
        
      });
    }
    
    glmNetwork.on("doubleClick", (params) => {
  
      if(params.nodes[0] === undefined)
      {
        alert("Double click on a node to edit.");
      }
      else
      {
        setCurrentNode(data.nodes.get(params.nodes[0]));
        document.getElementById("node-popUp").style.display = "block";
      }
  
    });

    glmNetwork.on("oncontext", (params) => {

      const edgeID = glmNetwork.getEdgeAt(params.pointer.DOM) !== undefined ?
        glmNetwork.getEdgeAt(params.pointer.DOM) :
        null;
      
      if(edgeID !== null)
      {
        setContextMenuData({edgeID: edgeID});
      }
    })
    
  }, [container, setCurrentNode, setContextMenuData]);

  return (
    <>
      <SearchBar 
        data = {data.nodes}
        physicsToggle = {TogglePhysics}
        reset = {Reset}
        onFind = {NodeFocus}
        prev = {Prev}
        next = {Next}
        download = {Export}
        addGraphOverlay={addOverlay}
        updateData={updateData}
      />

      <NodePopup 
        onMount={onChildMount} 
        onSave = {saveEdits} 
        onClose = {closePopUp}
      />

      <div id = "networks-wrapper">
        <div
          className='main-network'
          onContextMenu={handleContextmenu}
          ref={container}
        />

        <EdgeContextMenu
          onMount = {onContextMenuChildMount} 
          hideEdge={hideEdge}
          hideEdgeType={hideEdgeType}
        />

        <div id='circularProgress'>
          <span id='progressValue'>0%</span>
        </div>

        <Legend 
          findGroup = {HighlightGroup} 
          findEdges = {HighlightEdges}
          nodeCounts = {objectTypeCount}
          hideObjects={hideObjects}
        />
      </div>
    </>
  );
}

export default Graph;