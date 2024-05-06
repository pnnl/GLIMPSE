import React, { useState } from "react";
import PlotModal from "./PlotModal.js";
import OverlayUpload from "./OverlayUpload.js";
import Button from "@mui/material/Button";
import { createTheme, ThemeProvider } from "@mui/material";
import Stack from "@mui/material/Stack";
import ButtonGroup from "@mui/material/ButtonGroup";
import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from "@mui/material/Switch";
import SearchIcon from "@mui/icons-material/Search";
import IconButton from "@mui/material/IconButton";
import StatsTableModal from "./StatsTableModal.js";
import Autocomplete from "@mui/material/Autocomplete";

const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ActionBar = ({
   nodesDataObj,
   graphDataObj,
   onFind,
   reset,
   prev,
   next,
   physicsToggle,
   addGraphOverlay,
   nodeIDs,
   toggleLegendRef,
   showLegendStateRef
}) => {
   const nodes = nodesDataObj;
   const [node, setNode] = useState(null);
   const [stats, setStats] = useState(null);
   const [imgUrl, setImgUrl] = useState(null);
   const [checked, setChecked] = useState(false);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [showUpload, setShowUpload] = useState(false);
   const theme = createTheme({
      palette: {
         primary: {
            main: "#333333"
         },
         secondary: {
            main: "#b25a00"
         }
      }
   });

   /**
    * Hide/Show the Legend Component
    * @param {Event} e 
    */
   const toggleLegend = (e) => {
      e.preventDefault();

      if (showLegendStateRef.current) {
         document.getElementById("graph").style.width = "100%";
         document.getElementById("circularProgress").style.left = "45%"
         toggleLegendRef.current(false);
      }
      else {
         if (document.getElementById("layout-form").style.display === "flex") {
            document.getElementById("layout-form").style.display = "none";
         }
         document.getElementById("graph").style.width = "70%";
         document.getElementById("circularProgress").style.left = "35%"
         toggleLegendRef.current(true);
      }
   }

   /**
    * Trigger the find function from the Graph component to focus on the selected node ID
    * @param {Event} e 
    */
   const handleSubmit = (e) => {
      e.preventDefault();
      
      if (nodes.get(node)) onFind(node);
      else alert(`${node} is not in the graph.`);
   }

   /**
    * Call the reset function from the Graph component to revert to original styles
    * @param {Event} e 
    */
   const handleReset = (e) => {
      e.preventDefault();
      reset();
   }

   /**
    * Call the Prev function from the Graph component to focus on a previously focused node
    * @param {Event} e 
    */
   const handlePrev = (e) =>  {
      e.preventDefault();
      prev();
   }

   /**
    * Call the Next function from the Graph component to focus on the next highlighted node
    * @param {Event} e 
    */
   const handleNext = (e) => {
      e.preventDefault();
      next();
   }

   const autoLayout = (e) => {
      physicsToggle(e.target.checked);
      setChecked(e.target.checked)
   }

   /**
    * Communicate With the main process to get a buffer of the plot and display it
    * @param {Event} e 
    */
   const plot = async (e) => {
      e.preventDefault();
      
      if (imgUrl === null) {
         // getPlot returns a Uint8Array of the png
         const plot = await window.glimpseAPI.getPlot();
         const imgUrl = URL.createObjectURL(
            new Blob([plot.buffer], {type: "image/png"})
         );

         setImgUrl(imgUrl);
         setShowPlot(true);
      }
      else {
         setShowPlot(true);
      }
   }

   /**
    * Send the entire graph data object to the main process and extract statistic using networkx
    * @param {Event} e 
    */
   const showStats = async (e) => {
      e.preventDefault();

      if (stats === null) {
         const statsObj = await window.glimpseAPI.getStats(JSON.stringify(graphDataObj));
         setStats(statsObj);
         setShowTable(true);
      }
      else {
         setShowTable(true);
      }
   }

   /**
    * show the overlay upload component
    * @param {Event} e 
    */
   const showOverlay = (e) => {
      e.preventDefault();
      setShowUpload(true)
   }

   return (
      <>
      <Box sx={{padding: "6px", display: "flex", flexDirection: "row", justifyContent: "end"}}>
         <ThemeProvider theme={theme}>
               <Stack direction="row" spacing={1} sx={{marginRight: "auto"}}>
                  <Button 
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={plot}>
                     {appOptions.buttons.plotBtn}
                  </Button>

                  <Button
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={showStats}>
                     {appOptions.buttons.showStatsBtn}
                  </Button>

                  <Button
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={showOverlay}>
                     {appOptions.buttons.addOverlayBtn}
                  </Button>
               </Stack>

               <FormGroup>
                  <FormControlLabel
                     control={<Switch checked={checked} onChange={autoLayout} />}
                     label={appOptions.buttons.layoutLbl}
                     />
               </FormGroup>

               <Autocomplete sx={{width: 200}}
                  size="small"
                  id="autocomplete-nodeID-search"
                  options = {nodeIDs}
                  onChange={(even, ID) => {
                     setNode(ID)
                  }}
                  renderInput={(params) =>
                     <TextField
                        variant="outlined"
                        {...params} 
                        label={appOptions.buttons.searchLbl}
                     />
                  }
               />

               <Stack direction="row" spacing={2}>
                  <IconButton
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={handleSubmit}
                     >
                     <SearchIcon />
                  </IconButton>

                  <ButtonGroup variant="outlined" aria-label="cycle through nodes">
                     <Button
                           size="small"
                           color="primary"
                           onClick={handlePrev}
                           >
                           {appOptions.buttons.previousBtn}
                     </Button>
                     <Button
                           size="small"
                           color="primary"
                           onClick={handleNext}
                           >
                           {appOptions.buttons.nextBtn}
                     </Button>
                  </ButtonGroup>

                  <Button
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={handleReset}
                     >
                     {appOptions.buttons.resetBtn}
                  </Button>

                  <Button 
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={toggleLegend}
                     >
                  {appOptions.buttons.toggleLegendBtn}
                  </Button>
               </Stack>
         </ThemeProvider>
      </Box>
      <StatsTableModal
         show = {showTable}
         data = {stats}
         close={() => setShowTable(false)}
      />
      <OverlayUpload
         show = {showUpload}
         overlayFunc = {addGraphOverlay}
         close={() => setShowUpload(false)}
      />
      <PlotModal
         plot={imgUrl}
         show={showPlot}
         close={() => setShowPlot(false)}
      />
      </>
   );
}

export default ActionBar;