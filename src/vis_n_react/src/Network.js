import React, {useEffect, useRef} from 'react';
import {Network} from 'vis-network';
import { DataSet } from 'vis-data';
import SearchBar from './SearchBar';
import './styles/vis-network.css';
import Legend from './visLegend';
import loadImg from './imgs/load.png';
import capacitorImg from './imgs/capacitor.jpg';
import inverterImg from './imgs/inverter.png';
import meterImg from './imgs/meter.jpg';
import substationImg from './imgs/substation.jpg';
import generatorImg from './imgs/generator.jpg';

// import dynamic_fixedData from './data/IEEE-123_Dynamic_fixed.json';
// import invertersData from './data/IEEE-123_Inverters_fixed.json';
// import dieselsData from './data/IEEE-123_Diesels_fixed.json';

import IEEE_NFH from './data/9500/IEEE_9500.json';
import IEEE_INV from './data/9500/Inverters.json'
import IEEE_GEN from './data/9500/Rotating_Machines.json'

const dataFiles = [IEEE_NFH, IEEE_INV, IEEE_GEN];
// const dataFiles = [dynamic_fixedData,invertersData,dieselsData];

var glmNetwork = null;
var counter = -1;
const options = {
  edges: {
    smooth: {
      enabled: true,
      type: "dynamic"
    }
  },
  nodes: {
    shapeProperties: {
      interpolation: false
    }
  },
  groups:{
    load: {"color": "#2a9d8f","size": 25, "borderWidth": 4, "shape": "circularImage", "image": loadImg},
    triplex_load:{"color": "#ffea00","size": 25, "borderWidth": 4, "shape": "circularImage","image": loadImg},
    capacitor:{"color": "#283618","size": 25, "borderWidth": 4, "shape": "circularImage","image": capacitorImg},
    triplex_node:{"color": "#003566","size": 25, "borderWidth": 4, "shape": "circularImage","image": ""},
    substation:{"color": "#fca311","size": 25, "borderWidth": 4, "shape": "circularImage","image": substationImg},
    triplex_meter:{"color": "#072ac8","size": 25, "borderWidth": 4, "shape": "circularImage","image": meterImg},
    node:{"color": "#4361ee","size": 25, "borderWidth": 4, "shape": "dot", "image": ""},
    meter:{"color": "#d90429","size": 25, "borderWidth": 4, "shape": "circularImage", "image": meterImg},
    inverter:{"color": "#c8b6ff","size": 25, "borderWidth": 4, "shape": "circularImage", "image": inverterImg},
    generator:{"color": "#fee440","size": 25, "borderWidth": 4, "shape": "circularImage", "image": generatorImg},
  },
  interaction: {
    hover:true,
    hideEdgesOnDrag: true,
    hideEdgesOnZoom: true,
    navigationButtons: true
  },
  physics: {
    barnesHut: {
      gravitationalConstant: -80000,
      springLength: 200,
      springConstant: 0.50,
    },
    maxVelocity: 150,
    minVelocity: 0.75,
    solver: 'barnesHut',
    stabilization: {
      enabled: true,
      iterations: 1000,
      updateInterval: 1,
      onlyDynamicEdges: false,
      fit: true
    },
  },
};
const edgeTypes = ["overhead_line", "switch", "underground_line", "series_reactor", "triplex_line", "regulator","transformer"];
const nodeTypes = ["load", "triplex_load","capacitor", "node", "triplex_node","substation",
                    "meter", "triplex_meter", "inverter_dyn", "inverter", "diesel_dg"];
const parent_child_edge_types = ["capacitor", "triplex_meter", "triplex_load", "meter"];

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
                    ["diesel_dg", {"group": "generator"}]]);

const edgeOptions = new Map([["overhead_line", {"width": 4, "color": "#000000"}],
                            ["switch", {"width": 4, "color": "#3a0ca3"}],
                            ["series_reactor", {"width": 4, "color": "#8c0000"}],
                            ["triplex_line", {"width": 4, "color": "#c86bfa"}],
                            ["underground_line", {"width": 4, "color": "#FFFF00"}],
                            ["regulator", {"width": 4, "color": "#ff447d"}],
                            ["transformer", {"width": 4,"color": "#00FF00"}]]);

var nodes = [];
for (let file of dataFiles)
{
  var objs = file.objects;

  for (let obj of objs)
  {
    var objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
    var attributes = obj.attributes;
    if (nodeTypes.includes(objectType))
    {
      var nodeID = attributes.name;
      nodes.push({id: nodeID, label: nodeID, 
                group: nodeOptions.get(objectType).group,
                title: "Object Type: " + objectType + "\n" + getTitle(attributes)});
    }
  }
}
var nodesDataSet = new DataSet(nodes);

const edges = [];
for (let file of dataFiles)
{
  objs = file.objects;

  for (let obj of objs)
  {
    objectType = obj.name.includes(":") ? obj.name.split(":")[0] : obj.name;
    attributes = obj.attributes;
    if (edgeTypes.includes(objectType))
    {
      var edgeFrom = attributes.from.includes(":") ? attributes.from.split(":")[1] : attributes.from;
      var edgeTo = attributes.to.includes(":") ? attributes.to.split(":")[1] : attributes.to;
      var edgeID = obj.name.includes(":") ? obj.name : objectType + ":" + attributes.name;

      edges.push({from: edgeFrom, to: edgeTo,
                id: edgeID,
                color: edgeOptions.get(objectType).color,
                width: edgeOptions.get(objectType).width,
                title: "Object Type: " + objectType + "\n" + getTitle(attributes)});
    }
    else if (parent_child_edge_types.includes(objectType))
    {
      nodeID = attributes.name;
      var parent = attributes.parent;

      if(parent !== undefined)
      {
        edges.push({from: parent, to: nodeID, color: {inherit: true}});
      }
    }
    else if(nodeTypes.includes(objectType))
    {
      nodeID = attributes.name;
      parent = attributes.parent;
      
      if(parent !== undefined)
      {
        edges.push({from: parent, to: nodeID, color: {inherit: true}});
      }
    }
  }
}
var edgesDataSet = new DataSet(edges);

const data = {
  nodes: nodesDataSet,
  edges: edgesDataSet
}

const Graph = () => {
  const container = useRef(null);

  useEffect(() =>{
    glmNetwork = new Network(container.current, data, options);
    glmNetwork.on("stabilizationProgress", function (params) {
      var maxWidth = 496;
      var minWidth = 20;
      var widthFactor = params.iterations / params.total;
      var width = Math.max(minWidth, maxWidth * widthFactor);

      document.getElementById("bar").style.width = width + "px";
      document.getElementById("text").innerText =
        Math.round(widthFactor * 100) + "%";
    });
    
    glmNetwork.once("stabilizationIterationsDone", function () {
      document.getElementById("text").innerText = "100%";
      document.getElementById("bar").style.width = "496px";
      document.getElementById("loadingBar").style.opacity = 0;
      // really clean the dom element
      setTimeout(function () {
        document.getElementById("loadingBar").style.display = "none";
      }, 500);

      glmNetwork.setOptions({physics: {enabled: false}})
    });
  }, [container, data]);

  return (
    <>
      <div id='wrapper'>
      <SearchBar 
        data = {data.nodes} 
        reset = {Reset} 
        onFind = {NodeFocus}
        prev = {Prev}
        next = {Next}
      />
        <div className='mainNetwork' ref={container} />
        <div id="loadingBar">
          <div className="outerBorder">
            <div id="text">0%</div>
              <div id="border">
                <div id="bar"></div>
              </div>
            </div>
        </div>
        <Legend findGroup = {HighlightGroup} findEdges = {HighlightEdges}/>
      </div>
    </>
  );
}

function Reset() {
  let nodeItems = data.nodes.map((n) => {
    if(n.color)
    {
      delete n.color;
      return n;
    }
    if(n.size)
    {
      delete n.size;
      return n;
    }
  });
  data.nodes.update(nodeItems);

  let edgeItems = data.edges.map((e) => {
    if(e.width === 20)
    {
      e.width = 4;
      return e;
    }
    if(edgeTypes.includes(e.id.split(":")[0]))
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
  data.edges.update(edgeItems);
  glmNetwork.fit();
  counter = 0;
}

function Prev()
{
  var options = {
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  var prev = data.nodes.get({
    filter: function (n) {
      return (n.size === 50);
    }
  });

  counter--;
  if(counter < 0)
  {
    counter = prev.length - 1;
  }
  glmNetwork.focus(prev[counter].id, options)
}

function Next()
{
  var options = {
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  var nxt = data.nodes.get({
    filter: function (n) {
      return (n.size === 50);
    }
  });

  counter++;
  if(counter >= nxt.length)
  {
    counter = 0;
    glmNetwork.focus(nxt[counter].id, options)
  }
  else
  {
    glmNetwork.focus(nxt[counter].id, options)
  }
}

function NodeFocus(nodeID)
{
  var options = {
    scale: 1,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart"
    }
  };

  glmNetwork.focus(nodeID, options)
}

function HighlightGroup(group)
{
  var nodesMap = data.nodes.map((n) => {
    if(n.group === group)
    {
      delete n.color;
      n.size = 50;
      return n;
    }
    else
    {
      delete n.size;
      n.color = "lightgrey";
      return n;
    }
  });

  var edgesMap = data.edges.map((e) => {
    if(!(e.width === 20))
      e.color = 'lightgrey';

    return e;
  });
  // console.log(nodesMap);
  data.nodes.update(nodesMap);
  data.edges.update(edgesMap);
}

function HighlightEdges(edgeID)
{
  let nodeItems = data.nodes.map((n) => {
    if (!(n.size === 50))
    {
      n.color = "lightgrey";
    }
    return n;
  });
  // console.log(nodeItems);
  
  let edgeItems = data.edges.map((e) => {
    if(e.id.split(":")[0] === edgeID)
    {
      e.color = edgeOptions.get(edgeID).color;
      e.width = 20;
      return e;
    }
    else
    {
      e.color = "lightgrey";
      e.width = 4;
      return e;
    }
  });
  
  data.nodes.update(nodeItems);
  data.edges.update(edgeItems);
}

function getTitle(attributes)
{
  let str = "";
  for (let [k, v] of Object.entries(attributes))
  {
    str = str + k +": " + v +"\n";
  }
  return str;
}

export default Graph;