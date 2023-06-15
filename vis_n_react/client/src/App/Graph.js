import React, {useEffect, useRef} from 'react';
import "../styles/Graph.css";
import {Network} from 'vis-network';
import { DataSet } from 'vis-data';
import SearchBar from './SearchBar';
import axios from 'axios';
import NodePopup from './NodePopup';
import '../styles/vis-network.css';
import Legend from './Legend';
import options from './graphConfig/graphOptions.js';

const data = {
  nodes: new DataSet(),
  edges: new DataSet()
};

let glmNetwork;
let counter = -1;
const objectTypeCount = {"nodes": {"load": 0, "node": 0, "meter": 0, "inverter": 0,
                       "inverter_dyn": 0, "diesel_dg": 0, "capacitor": 0, "triplex_load": 0, 
                       "triplex_node": 0, "triplex_meter": 0, "substation": 0},
                        "edges": {"overhead_line": 0, "switch": 0, "underground_line": 0,
                        "series_reactor": 0, "triplex_line": 0, "regulator": 0,"transformer": 0}};

//These types are what are considered edges
const edgeTypes = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line",
"regulator","transformer", "mapping", "communication", "microgrid_connection"];

//These types are recognized as nodes by electrical engineers.
const nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation", "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg", "communication_node", "microgrid_node"];

//These edges or connections are between parent and child nodes
const parent_child_edge_types = ["capacitor", "triplex_meter", "triplex_load", "meter"];

//these nodes options can be further changed in the options object below
const nodeOptions = new Map([["load", {"group": "load"}],
                    ["triplex_load", {"group": "triplex_load"}],
                    ["capacitor", {"group": "capacitor"}],
                    ["triplex_node", {"group": "triplex_node"}],
                    ["substation", {"group": "substation"}],
                    ["triplex_meter", {"group": "triplex_meter"}],
                    ["node", {"group": "node"}],
                    ["meter", {"group": "meter"}],
                    ["inverter", {"group": "inverter"}],
                    ["inverter_dyn", {"group": "inverter"}],
                    ["diesel_dg", {"group": "generator"}],
                    ["microgrid_node", {"group": "microgrid_node"}],
                    ["communication_node", {"group": "communication_node"}]]);
                    
const edgeOptions = new Map([["overhead_line", {"width": 1, "color": "#000000", "hidden": false}],
                            ["switch", {"width": 1, "color": "#3a0ca3", "hidden": false}],
                            ["series_reactor", {"width": 1, "color": "#3c1642", "hidden": false}],
                            ["triplex_line", {"width": 1, "color": "#c86bfa", "hidden": false}],
                            ["underground_line", {"width": 1, "color": "#FFFF00", "hidden": false}],
                            ["regulator", {"width": 1, "color": "#ff447d", "hidden": false}],
                            ["transformer", {"width": 1,"color": "#00FF00", "hidden": false}],
                            ["mapping", {"width": 0.15, "color": {"inherit": true}, "hidden": true}],
                            ["communication", {"width": 0.15, "color": {"inherit": false}, "hidden": false}],
                            ["microgrid_connection", {"width": 0.15, "color": "cyan", "hidden": false}]]);

//This functions turns attributes of a node or edge to a string tile that may be displayed
const getTitle = (attributes) => {
  let str = "";
  for (let [k, v] of Object.entries(attributes))
  {
    str += k +": " + v +"\n";
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
      let objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
      let attributes = obj.attributes;
      if (nodeTypes.includes(objectType))
      {
        let nodeID = attributes.name;
        data.nodes.add({id: nodeID, label: nodeID,
                        attributes: attributes,
                        group: nodeOptions.get(objectType).group,
                        title: "Object Type: " + objectType + "\n" + getTitle(attributes),
                        x: attributes.x === undefined ? undefined : parseInt(attributes.x, 10),
                        y: attributes.y === undefined ? undefined : parseInt(attributes.y, 10)});

        objectTypeCount.nodes[objectType]++;
      }
    }
  }

  for (let file of files)
  {
    
    let objs = file.objects;
  
    for (let obj of objs)
    {
      let objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
      let attributes = obj.attributes;
      if (edgeTypes.includes(objectType))
      {
        let edgeFrom = attributes.from.includes(":") ? attributes.from.split(":")[1] : attributes.from;
        let edgeTo = attributes.to.includes(":") ? attributes.to.split(":")[1] : attributes.to;
        let edgeID = obj.name.includes(":") ? obj.name : objectType + ":" + attributes.name;
        
        data.edges.add({from: edgeFrom, to: edgeTo, id: edgeID,
                  color: edgeOptions.get(objectType).color,
                  width: edgeOptions.get(objectType).width,
                  hidden: edgeOptions.get(objectType).hidden,
                  title: "Object Type: " + objectType + "\n" + getTitle(attributes)});
        
        objectTypeCount.edges[objectType]++;
      }
      else if (parent_child_edge_types.includes(objectType))
      {
        let nodeID = attributes.name;
        let parent = attributes.parent;
  
        if(parent !== undefined)
        {
          data.edges.add({from: parent, to: nodeID, color: {inherit: true}});
        }
      }
      else if(nodeTypes.includes(objectType))
      {
        let nodeID = attributes.name;
        let parent = attributes.parent;
        
        if(parent !== undefined)
        {
          data.edges.add({from: parent, to: nodeID, color: {inherit: true}});
        }
      }
    }
  }
}

const NodeFocus = (nodeID) => {
    
  const options = {
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  glmNetwork.focus(nodeID, options)
}

const Reset = () => {

  let nodeItems = data.nodes.map((n) => {
    if(n.color)
    {
      delete n.color;
      return n;
    }
    else if(n.size)
    {
      delete n.size;
      return n;
    }
    return n;
  });
  
  let edgeItems = data.edges.map((e) => {
    if(e.width === 6)
    {
      e.width = 1;
      return e;
    }
    else if(edgeTypes.includes(e.id.split(":")[0]))
    {
      e.color = edgeOptions.get(e.id.split(":")[0]).color;
      e.width = edgeOptions.get(e.id.split(":")[0]).width;
      return e;
    }
    else
    {
      e.color = {inherit: true};
      return e;
    }
  });

  data.nodes.update(nodeItems);
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
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  let prev = data.nodes.get({
    filter: (n) => {
      return (n.size === 30);
    }
  });
  
  counter--;
  if(counter < 0)
  {
    counter = prev.length - 1;
  }
  glmNetwork.focus(prev[counter].id, options)
}

const Next = () => {

  const options = {
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  let next = data.nodes.get({
    filter: (n) => {
      return (n.size === 30);
    }
  });

  counter++;
  if(counter >= next.length)
  {
    counter = 0;
    glmNetwork.focus(next[counter].id, options)
  }
  else
  {
    glmNetwork.focus(next[counter].id, options)
  }
}

const HighlightGroup = (nodeType) => {
  
  let nodesMap = data.nodes.map((node) => {
    if(node.group === nodeType)
    {
      delete node.color;
      node.size = 30;
      return node;
    }
    else if (node.size !== 30)
    {
      delete node.size;
      node.color = "lightgrey";
      return node;
    }

    return node;
  });
  
  let edgesMap = data.edges.map((edge) => {
    if(edge.width !== 6)
    {
      edge.color = 'lightgrey';
    }
    return edge;
    
  });

  data.nodes.update(nodesMap);
  data.edges.update(edgesMap);
}

const HighlightEdges = (edgeType) => {
  
  let nodeItems = data.nodes.map((n) => {
    if (n.size !== 30)
    {
      n.color = "lightgrey";
    }
    return n;
  });
  
  let edgeItems = data.edges.map(( edge ) => {
    if( edge.id.split( ":" )[ 0 ] === edgeType )
    {
      edge.color = edgeOptions.get( edgeType ).color;
      edge.width = 6;
      return edge;
    }
    else if( edge.width !== 6)
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

        let objType = object.name.includes( ":" ) ? object.name.split( ":" )[ 0 ] : object.name;

        if ( nodeTypes.includes( objType ) )
        {
          let newNodeAttributes = data.nodes.get( object.attributes.name ).attributes;

          object.attributes = newNodeAttributes;
        }
        
      });

    });

    const axios_instance = axios.create({
      baseURL: 'http://localhost:3500',
      timeout: 20000,
      headers: {'Content-Type': 'application/json'}
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

  //Update current nodes with update JSON string
  const updateData = ( updateObj ) => {
    const nodeToUpdate = data.nodes.get(updateObj.id);
    
  }

  let setCurrentNode = null;
  const onChildMount = (childSetFunc) => {

    setCurrentNode = childSetFunc;

  }

  const container = useRef(null);
  useEffect(() => {

    if(data.nodes.get()[0].x !== undefined && data.nodes.get()[0].y !== undefined)
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
        
        let maxWidth = 360;
        let minWidth = 1;
        let widthFactor = params.iterations / params.total;
        let width = Math.max(minWidth, maxWidth * widthFactor);
        document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 "+ width +"deg, #333 0deg)";
        document.getElementById("progressValue").innerText = Math.round(widthFactor * 100) + "%";
      
      });
      
      glmNetwork.once("stabilizationIterationsDone", () => {
        
        document.getElementById("circularProgress").style.background = "conic-gradient(#b25a00 360deg, #333 0deg)";
        document.getElementById("progressValue").innerText = "100%";
        document.getElementById("circularProgress").style.opacity = 0.7;
        
        setTimeout(() => {
  
          document.getElementById("circularProgress").style.display = "none";
  
        }, 500);
        
        glmNetwork.setOptions({physics: {enabled: false}})
  
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
    
  }, [container, setCurrentNode]);

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
      />

      <NodePopup 
        onMount={onChildMount} 
        onSave = {saveEdits} 
        onClose = {closePopUp}
      />

      <div id = "networks-wrapper">
        <div className='main-network' ref={container}/>
        <div id='circularProgress'>
          <span id='progressValue'>0%</span>
        </div>
        
        <Legend 
          findGroup = {HighlightGroup} 
          findEdges = {HighlightEdges}
          nodeCounts = {objectTypeCount}
        />
      </div>
    </>
  );
}

export default Graph;