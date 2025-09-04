import React, { Suspense, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
   Table,
   TableBody,
   TableContainer,
   TableCell,
   TableRow,
   TableHead,
   Paper,
   Typography,
   TextField,
   Button,
   Box,
   Tabs,
   Tab
} from "@mui/material";
import axios from "axios";
import AttributesTable from "./AttributesTable";

const EditObject = ({ object, onSave, isCIM }) => {
   const [objectToEdit, setObjectToEdit] = useState(null);
   const [tabValue, setTabValue] = useState(0);
   const [loading, setLoading] = useState(true);

   const handleChange = (event) => {
      const { name, value } = event.target;
      setObjectToEdit((prev) => ({
         ...prev,
         [name]: value
      }));
   };

   const handleSave = () => {
      if (onSave) {
         onSave({ ...object, attributes: { ...object.attributes, ...objectToEdit } });
      }
   };

   const getCIMObject = async (mRID) => {
      try {
         const responsePromise = axios.get(`http://127.0.0.1:5051/api/objects/${mRID}`);
         const response = await responsePromise;

         console.log(response.data);

         setObjectToEdit({ ...response.data.object });
      } catch (error) {
         console.log(error);
      }
   };

   useEffect(() => {
      if (isCIM) {
         getCIMObject(object.attributes.mRID);
         setLoading(false);
      } else {
         setObjectToEdit(object ? object.attributes : null);
         setLoading(false);
      }
   }, [object, isCIM]);

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
               <Tab label="Associations" />
               <Tab label="Mermaid" />
            </Tabs>
         </Box>
         {tabValue === 0 && (
            <Suspense fallback={<div>Loading Attributes...</div>}>
               <AttributesTable
                  name={object.attributes.name}
                  attributes={objectToEdit.attributes}
               />
            </Suspense>
         )}
         {tabValue === 1 && (
            <Suspense fallback={<div>Loading Associations...</div>}>
               <AttributesTable
                  name={object.attributes.name}
                  attributes={objectToEdit.associations}
               />
            </Suspense>
         )}
      </Box>
   );
};

EditObject.propTypes = {
   object: PropTypes.shape({
      attributes: PropTypes.object.isRequired
   }).isRequired,
   onSave: PropTypes.func,
   isCIM: PropTypes.bool
};

export default EditObject;
