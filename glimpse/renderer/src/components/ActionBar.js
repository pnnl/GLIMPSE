import React, { useEffect, useState } from "react";
import {
   Box,
   Stack,
   Button,
   Switch,
   TextField,
   FormGroup,
   IconButton,
   createTheme,
   ButtonGroup,
   Autocomplete,
   ThemeProvider,
   FormControlLabel,
} from "@mui/material";
import OverlayUpload from "./OverlayUpload.js";
import PlotModal from "./PlotModal.js";
import SearchIcon from "@mui/icons-material/Search";
import StatsTableModal from "./StatsTableModal.js";

const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ActionBar = ({
   showLegendStateRef,
   addGraphOverlay,
   toggleLegendRef,
   physicsToggle,
   nodesDataObj,
   graphDataObj,
   getNodeIds,
   removeOverlay,
   onFind,
   reset,
   prev,
   next,
}) => {
   const nodes = nodesDataObj;
   const [node, setNode] = useState(null);
   const [stats, setStats] = useState(null);
   const [imgUrl, setImgUrl] = useState(null);
   const [checked, setChecked] = useState(false);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [showUpload, setShowUpload] = useState(false);
   const [displayRemoveOverlayBtn, setDisplayRemoveOverlayBtn] = useState("none");

   const theme = createTheme({
      palette: {
         primary: {
            main: "#333333",
         },
         secondary: {
            main: "#b25a00",
         },
      },
   });

   /**
    * Hide/Show the Legend Component
    * @param {Event} e
    */
   const toggleLegend = (e) => {
      e.preventDefault();

      const graph = document.getElementById("graph");
      const circularProgress = document.getElementById("circularProgress");
      const layoutForm = document.getElementById("layout-form");
      const rotateBtns = document.getElementById("rt-btns-wrapper");

      if (showLegendStateRef.current) {
         toggleLegendRef.current(false);
         rotateBtns.style.left = "96%";
         graph.style.width = "100%";
         circularProgress.style.left = "50%";
      } else {
         if (layoutForm.style.display === "flex") {
            layoutForm.style.display = "none";
         }
         rotateBtns.style.left = "68%";
         graph.style.width = "72%";
         circularProgress.style.left = "36%";
         toggleLegendRef.current(true);
      }
   };

   /**
    * Trigger the find function from the Graph component to focus on the selected node ID
    * @param {Event} e
    */
   const handleSubmit = (e) => {
      e.preventDefault();

      if (nodes.get(node)) onFind(node);
      else alert(`${node} is not in the graph.`);
   };

   const autoLayout = (e) => {
      physicsToggle(e.target.checked);
      setChecked(e.target.checked);
   };

   /**
    * Communicate With the main process to get a buffer of the plot and display it
    * @param {Event} e
    */

   /**
    * Send the entire graph data object to the main process and extract statistic using networkx
    */
   const showStats = async () => {
      if (stats === null) {
         const statsObj = await window.glimpseAPI.getStats(JSON.stringify(graphDataObj));
         setStats(statsObj);
         setShowTable(true);
      } else {
         setShowTable(true);
      }
   };

   const getPlotImg = ({ buffer }) => {
      const imgUrl = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));

      setImgUrl(imgUrl);
      setShowPlot(true);
   };

   const handleRemoveOverlay = () => {
      removeOverlay();
      setDisplayRemoveOverlayBtn("none");
   };

   useEffect(() => {
      const removeListenersArr = [];
      removeListenersArr.push(window.glimpseAPI.getEmbeddingsPlot(getPlotImg));
      removeListenersArr.push(window.glimpseAPI.onGetMetrics(showStats));

      return () => {
         for (let removeListener of removeListenersArr) {
            removeListener();
         }
      };
   }, []);

   return (
      <>
         <Box sx={{ padding: "6px", display: "flex", flexDirection: "row", justifyContent: "end" }}>
            <ThemeProvider theme={theme}>
               <Stack direction="row" spacing={1} sx={{ marginRight: "auto" }}>
                  <Button
                     sx={{ display: displayRemoveOverlayBtn }}
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={handleRemoveOverlay}
                  >
                     Remove Overlay
                  </Button>
                  <Button
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={() => setShowUpload(true)}
                  >
                     {appOptions.buttons.addOverlayBtn}
                  </Button>
               </Stack>

               <FormGroup>
                  <FormControlLabel
                     control={<Switch checked={checked} onChange={autoLayout} />}
                     label={appOptions.buttons.layoutLbl}
                  />
               </FormGroup>

               <Autocomplete
                  sx={{ width: 200 }}
                  size="small"
                  id="autocomplete-nodeID-search"
                  options={getNodeIds()}
                  onChange={(even, ID) => setNode(ID)}
                  renderInput={(params) => (
                     <TextField variant="outlined" {...params} label={appOptions.buttons.searchLbl} />
                  )}
               />

               <Stack direction="row" spacing={2}>
                  <IconButton size="small" variant="outlined" color="primary" onClick={handleSubmit}>
                     <SearchIcon />
                  </IconButton>

                  <ButtonGroup variant="outlined" aria-label="cycle through nodes">
                     <Button size="small" color="primary" onClick={prev}>
                        {appOptions.buttons.previousBtn}
                     </Button>
                     <Button size="small" color="primary" onClick={next}>
                        {appOptions.buttons.nextBtn}
                     </Button>
                  </ButtonGroup>

                  <Button size="small" variant="outlined" color="primary" onClick={reset}>
                     {appOptions.buttons.resetBtn}
                  </Button>

                  <Button size="small" variant="outlined" color="primary" onClick={toggleLegend}>
                     {appOptions.buttons.toggleLegendBtn}
                  </Button>
               </Stack>
            </ThemeProvider>
         </Box>
         <StatsTableModal show={showTable} data={stats} close={() => setShowTable(false)} />
         <OverlayUpload
            show={showUpload}
            displayRemoveOverlayBtn={setDisplayRemoveOverlayBtn}
            overlayFunc={addGraphOverlay}
            close={() => setShowUpload(false)}
         />
         <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)} />
      </>
   );
};

export default ActionBar;
