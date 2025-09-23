import React, { useEffect, useState, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Box, Tabs, Tab, Autocomplete } from "@mui/material";
import { DataSet } from "vis-data";
import ObjectTable from "./ObjectTable";
import ObjectTypesPane from "./ObjectTypesPane";
import EditObject from "./EditObject";

const ObjectStudio = () => {
   const [tableData, setTableData] = useState(null);
   const [objectTypes, setObjectTypes] = useState(null);
   const [tabValue, setTabValue] = useState(0);
   const [objectColumns, setObjectColumns] = useState(null);
   const [filterTypes, setFilterTypes] = useState(null);
   const [objectToEditID, setObjectToEditID] = useState(null);
   const [isCIM, setIsCIM] = useState(false);

   useEffect(() => {
      window.glimpseAPI.onLoadObjects((data) => {
         if ("isCIM" in data) console.log("CIM data loaded", data.isCIM);
         // Create DataSet from edges
         const edges = new DataSet(data.edges);
         const nodes = new DataSet(data.nodes);

         // Get all unique attribute names across all edges and nodes
         const edgeColumns = new Set();
         const nodeColumns = new Set();
         const allEdgeTypes = new Set();
         const allNodeTypes = new Set();

         // add default "type" column
         edgeColumns.add("type");
         nodeColumns.add("type");

         edges.forEach((edge) => {
            allEdgeTypes.add(edge.type);
            Object.keys(edge.attributes).forEach((key) => {
               edgeColumns.add(key);
            });
         });

         nodes.forEach((node) => {
            allNodeTypes.add(node.type);
            Object.keys(node.attributes).forEach((key) => {
               nodeColumns.add(key);
            });
         });

         setObjectColumns({
            nodeColumns: Array.from(nodeColumns),
            edgeColumns: Array.from(edgeColumns)
         });
         setObjectTypes({
            nodeTypes: Array.from(allNodeTypes).sort(),
            edgeTypes: Array.from(allEdgeTypes).sort()
         });
         setTableData({ edges, nodes });
         setIsCIM(data.isCIM);
      });
   }, []);

   const handleTabChange = (_, newValue) => {
      setTabValue(newValue);
   };

   const filteredTableData = useMemo(() => {
      if (!filterTypes || Object.keys(filterTypes).length === 0) return tableData;

      // Only nodes filter
      if ("nodes" in filterTypes && !("edges" in filterTypes)) {
         return {
            nodes: new DataSet(
               tableData.nodes.get({ filter: (n) => filterTypes.nodes.includes(n.type) })
            ),
            edges: tableData.edges // show all edges
         };
      }

      // Only edges filter
      if ("edges" in filterTypes && !("nodes" in filterTypes)) {
         return {
            nodes: tableData.nodes, // show all nodes
            edges: new DataSet(
               tableData.edges.get({ filter: (e) => filterTypes.edges.includes(e.type) })
            )
         };
      }

      // Both filters
      if ("nodes" in filterTypes && "edges" in filterTypes) {
         return {
            nodes: new DataSet(
               tableData.nodes.get({ filter: (n) => filterTypes.nodes.includes(n.type) })
            ),
            edges: new DataSet(
               tableData.edges.get({ filter: (e) => filterTypes.edges.includes(e.type) })
            )
         };
      }
   }, [filterTypes, tableData]);

   return (
      <PanelGroup direction="horizontal" style={{ height: "100%" }}>
         <Panel style={{ borderRadius: "5px" }} defaultSize={20} minSize={15} maxSize={30}>
            <ObjectTypesPane
               objectTypes={objectTypes}
               setFilterTypes={setFilterTypes}
               filterTypes={filterTypes}
            />
         </Panel>
         <PanelResizeHandle className="panel-resize-handle horizontal-handle" />
         <Panel>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
               <Tabs
                  textColor="#333333"
                  sx={{
                     ["& .MuiTabs-indicator"]: { backgroundColor: "#45AB46" }
                  }}
                  value={tabValue}
                  onChange={handleTabChange}
               >
                  <Tab label="Edges" />
                  <Tab label="Nodes" />
                  <Tab label="Edit Object" />
               </Tabs>
            </Box>
            {tabValue === 0 && (
               <ObjectTable
                  isCIM={isCIM}
                  tableData={filteredTableData}
                  unfilteredData={tableData}
                  objectColumns={objectColumns}
                  setTabValue={setTabValue}
                  setObjectToEdit={setObjectToEditID}
               />
            )}
            {tabValue === 1 && (
               <ObjectTable
                  nodes
                  isCIM={isCIM}
                  setTabValue={setTabValue}
                  tableData={filteredTableData}
                  unfilteredData={tableData}
                  objectColumns={objectColumns}
                  setObjectToEdit={setObjectToEditID}
               />
            )}
            {tabValue === 2 && objectToEditID ? (
               <EditObject
                  isCIM={isCIM}
                  tableData={tableData}
                  objectID={objectToEditID}
                  setObject={setObjectToEditID}
               />
            ) : (
               <p>Select a node or edge from the table to edit</p>
            )}
         </Panel>
      </PanelGroup>
   );
};

export default ObjectStudio;
