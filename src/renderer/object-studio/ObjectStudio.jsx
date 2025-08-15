import React, { useEffect, useState, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Box, Tabs, Tab, Paper } from "@mui/material";
import { DataSet } from "vis-data";
import ObjectTable from "./ObjectTable";
import ObjectTypesPane from "./ObjectTypesPane";
import EditAttributeTable from "./EditAttributeTable";

const ObjectStudio = () => {
   const [tableData, setTableData] = useState(null);
   const [objectTypes, setObjectTypes] = useState(null);
   const [tabValue, setTabValue] = useState(0);
   const [objectColumns, setObjectColumns] = useState(null);
   const [filterTypes, setFilterTypes] = useState(null);
   const [objectToEdit, setObjectToEdit] = useState(null);

   useEffect(() => {
      console.log("ran in useEffect");
      window.glimpseAPI.onLoadObjects((data) => {
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
      });
   }, []);

   const handleTabChange = (_, newValue) => {
      setTabValue(newValue);
   };

   const filteredTableData = useMemo(() => {
      if (!filterTypes || Object.keys(filterTypes).length === 0) return tableData;

      if ("nodes" in filterTypes && !("edges" in filterTypes)) {
         return {
            nodes: new DataSet(
               tableData.nodes.get({ filter: (n) => filterTypes.nodes.includes(n.type) })
            ),
            edges: new DataSet(tableData.edges.get())
         };
      }

      if ("edges" in filterTypes && !("nodes" in filterTypes)) {
         return {
            nodes: new DataSet(tableData.nodes.get()),
            edges: new DataSet(
               tableData.edges.get({ filter: (e) => filterTypes.edges.includes(e.type) })
            )
         };
      }

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
                  sx={{ ["& .MuiTabs-indicator"]: { backgroundColor: "#45AB46" } }}
                  textColor="#333333"
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
                  tableData={filteredTableData}
                  objectColumns={objectColumns}
                  setTabValue={setTabValue}
                  setObjectToEdit={setObjectToEdit}
               />
            )}
            {tabValue === 1 && (
               <ObjectTable
                  nodes
                  setTabValue={setTabValue}
                  tableData={filteredTableData}
                  objectColumns={objectColumns}
                  setObjectToEdit={setObjectToEdit}
               />
            )}
            {tabValue === 2 && objectToEdit ? (
               <EditAttributeTable object={objectToEdit} onSave={(o) => console.log(o)} />
            ) : (
               <p>Select a node or edge from the table to edit</p>
            )}
         </Panel>
      </PanelGroup>
   );
};

export default ObjectStudio;
