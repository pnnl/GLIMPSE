import React, { useEffect, useState, useRef } from "react";
import { Box, Tabs, Tab, Paper } from "@mui/material";
import axios from "axios";
import AttributesTable from "./AttributesTable";
import MermaidDiagram from "./MermaidDiagram";

const EditObject = ({ objectID, isCIM, setObject, tableData }) => {
   const [objectToEdit, setObjectToEdit] = useState(null);
   const [mermaidContent, setMermaidContent] = useState(null);
   const [tabValue, setTabValue] = useState(0);
   const readOnlyAttributes = useRef(
      new Set(["name", "identifier", "mRID", "to", "from", "ConnectivityNodeContainer"])
   );

   const handleChange = (event) => {
      const { name, value } = event.target;
      setObjectToEdit((prev) => ({
         ...prev,
         attributes: { ...prev.attributes, [name]: value }
      }));
   };

   const handleSave = () => {
      if (isCIM) {
         const mRID = objectToEdit.attributes.mRID;
         // go through each attributes that is not read only and update the object
         Object.entries(objectToEdit.attributes).forEach(async ([key, val]) => {
            if (!readOnlyAttributes.current.has(key)) {
               try {
                  await axios
                     .put(`http://127.0.0.1:5051/api/objects/${mRID}`, {
                        attribute: key,
                        value: val
                     })
                     .then((res) => console.log(res.data));
               } catch (error) {
                  console.log(error);
               }
            }
         });
      } else {
         window.glimpseAPI.saveStudioChanges(objectToEdit);
      }
   };

   const getCIMObject = async (mRID) => {
      try {
         const responsePromise = axios.get(`http://127.0.0.1:5051/api/objects/${mRID}`);
         const response = await responsePromise;

         setObjectToEdit({ ...response.data.object });
         setTabValue(0);
      } catch (error) {
         console.log(error);
      }
   };

   const getMermaidDiagram = async (mRID) => {
      try {
         const responsePromise = axios.get(`http://127.0.0.1:5051/api/objects/${mRID}/mermaid`);
         const response = await responsePromise;
         setMermaidContent(response.data.mermaid);
      } catch (error) {
         console.log(error);
      }
   };

   useEffect(() => {
      if (isCIM) {
         getCIMObject(objectID);
         getMermaidDiagram(objectID);
      } else {
         setObjectToEdit(tableData[objectID.type === "edge" ? "edges" : "nodes"].get(objectID.id));
      }
   }, [objectID, isCIM]);

   const handleTabChange = (_, newValue) => {
      setTabValue(newValue);
   };

   if (!objectToEdit) return null;

   return (
      <Box sx={{ height: "100%" }}>
         <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
               value={tabValue}
               textColor="#333333"
               onChange={handleTabChange}
               sx={{ ["& .MuiTabs-indicator"]: { backgroundColor: "#45AB46" } }}
            >
               <Tab label="Attributes" />
               {isCIM && [<Tab key={0} label="Associations" />, <Tab key={1} label="Mermaid" />]}
            </Tabs>
         </Box>
         {tabValue === 0 && (
            <AttributesTable
               heading={objectToEdit.attributes.name ?? objectToEdit.id}
               readOnlyAttributesList={readOnlyAttributes}
               onChange={handleChange}
               attributes={objectToEdit.attributes}
               setObject={setObject}
               save={handleSave}
            />
         )}
         {isCIM && tabValue === 1 && (
            <AttributesTable
               heading={objectToEdit.attributes.name ?? objectToEdit.id}
               readOnlyAttributesList={readOnlyAttributes}
               attributes={objectToEdit.associations}
               setObject={setObject}
            />
         )}
         {isCIM && tabValue === 2 && (
            <MermaidDiagram
               mermaidContent={mermaidContent}
               objectID={objectToEdit.attributes.name}
            />
         )}
      </Box>
   );
};

export default EditObject;
