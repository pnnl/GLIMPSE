
export const nodeOptions = new Map([
   ["load",{"group": "load"}],
   ["triplex_load", {"group": "triplex_load"}],
   ["capacitor", {"group": "capacitor"}],
   ["triplex_node", {"group": "triplex_node"}],
   ["substation", {"group": "substation"}],
   ["triplex_meter", {"group": "triplex_meter"}],
   ["node", {"group": "node"}],
   ["meter", {"group": "meter"}],
   ["inverter_dyn", {"group": "inverter_dyn"}],
   ["diesel_dg", {"group": "diesel_dg"}],
   ["microgrid", {"group": "microgrid"}],
   ["communication_node", {"group": "communication_node"}]
]);
                     
export const edgeOptions = new Map([
   ["overhead_line", {
      "width": 2,
      "color": "#000000",
      "hidden": false
   }],
   ["switch", {
      "width": 2, 
      "color": "#3a0ca3", 
      "hidden": false
   }],
   ["series_reactor", {
      "width": 2, 
      "color": 
      "#3c1642", 
      "hidden": false
   }],
   ["triplex_line", {
      "width": 2, 
      "color": "#c86bfa", 
      "hidden": false
   }],
   ["underground_line", {
      "width": 2, 
      "color": "#FFFF00", 
      "hidden": false
   }],
   ["regulator", {
      "width": 2, 
      "color": "#ff447d", 
      "hidden": false
   }],
   ["transformer", {
      "width": 2,
      "color": "#00FF00", 
      "hidden": false
   }],
   ["parentChild", {
      "width": 2,
      "color": {"inherit": true}, 
      "hidden": false
   }],
   ["mapping", {
      "width": 0.15, 
      "color": 'lightgrey', 
      "hidden": false
   }],
   ["communication", {
      "width": 1, 
      "color": {"inherit": false},
      "hidden": false
   }],
   ["microgrid_connection", {
      "width": 1, 
      "color": "cyan", 
      "hidden": false
   }],
   ["line", {
      "width": 2, 
      "color": "black", 
      "hidden": false
   }]
]);

