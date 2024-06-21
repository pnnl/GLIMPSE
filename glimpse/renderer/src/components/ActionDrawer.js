import React, { useState, useEffect } from "react";
import {
   Autocomplete,
   Box,
   Drawer,
   IconButton,
   Fab,
   Divider,
   TextField,
   Stack,
   FormControlLabel,
   Switch,
   Button,
} from "@mui/material";
import { ChevronLeft, SearchRounded, TuneRounded } from "@mui/icons-material";
import OverlayUpload from "./OverlayUpload";
import StatsTableModal from "./StatsTableModal";
import PlotModal from "./PlotModal";
const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ActionDrawer = ({
   getNodeIds,
   findNode,
   physicsToggle,
   toggleLegendRef,
   showLegendStateRef,
   attachOverlay,
   removeOverlay,
   reset,
}) => {
   const nodes = getNodeIds();
   const [nodeID, setNodeID] = useState("");
   const [showOverlayUpload, setShowOverlayUpload] = useState(false);
   const [openDrawer, setOpenDrawer] = useState(false);
   const [hideRemoveOverlayBtn, setHideRemoveOverlayBtn] = useState("none");
   const [imgUrl, setImgUrl] = useState(null);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [stats, setStats] = useState(null);

   /**
    * Trigger the find function from the Graph component to focus on the selected node ID
    * @param {Event} e
    */
   const handleSubmit = (e) => {
      e.preventDefault();

      if (nodes.includes(nodeID)) findNode(nodeID);
      else alert(`${nodeID} is not in the graph.`);
   };

   const autoLayout = (e) => {
      physicsToggle(e.target.checked);
   };

   const closeDrawer = () => {
      setOpenDrawer(false);
   };

   /**
    * Hide/Show the Legend Component
    * @param {Event} e
    */
   const toggleLegend = (e) => {
      const graph = document.getElementById("graph");
      const circularProgress = document.getElementById("circularProgress");
      const layoutForm = document.getElementById("layout-form");

      if (showLegendStateRef.current) {
         toggleLegendRef.current(false);
         graph.style.width = "100%";
         circularProgress.style.left = "50%";
      } else {
         if (layoutForm.style.display === "flex") {
            layoutForm.style.display = "none";
         }
         graph.style.width = "72%";
         circularProgress.style.left = "36%";
         toggleLegendRef.current(true);
      }
   };

   const handleRemoveOverlay = () => {
      setHideRemoveOverlayBtn("none");
      removeOverlay();
   };

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
      <Box>
         <Stack spacing={1} direction={"row"} sx={{ position: "absolute", margin: 1 }}>
            <Fab
               sx={{
                  color: "#FFF",
                  border: "1px solid grey",
                  backgroundColor: "#333",
                  ":hover": { backgroundColor: "#b25a00" },
               }}
               variant="extended"
               onClick={() => setOpenDrawer(true)}
            >
               <TuneRounded />
            </Fab>
            <Fab
               sx={{
                  color: "#FFF",
                  border: "1px solid grey",
                  backgroundColor: "#333",
                  ":hover": { backgroundColor: "#b25a00" },
               }}
               onClick={reset}
               variant="extended"
            >
               Reset
            </Fab>
            <Fab
               sx={{
                  display: hideRemoveOverlayBtn,
                  color: "#FFF",
                  border: "1px solid grey",
                  backgroundColor: "#333",
                  ":hover": { backgroundColor: "#b25a00" },
               }}
               variant="extended"
               onClick={handleRemoveOverlay}
            >
               Remove Overlay
            </Fab>
         </Stack>
         <Drawer
            variant="persistent"
            anchor="left"
            open={openDrawer}
            onClose={closeDrawer}
            onMouseLeave={closeDrawer}
            sx={{
               flexShrink: 0,
               [`& .MuiDrawer-paper`]: { width: 240, top: "66px", boxSizing: "border-box" },
            }}
         >
            <div>
               <IconButton sx={{ float: "right" }} size="large" onClick={closeDrawer}>
                  <ChevronLeft />
               </IconButton>
            </div>
            <Divider />
            <Autocomplete
               sx={{ width: "100%" }}
               size="small"
               id="autocomplete-nodeID-search"
               options={getNodeIds()}
               onChange={(even, ID) => setNodeID(ID)}
               renderInput={(params) => (
                  <Stack sx={{ m: 1 }} direction="row" spacing={1}>
                     <TextField variant="outlined" {...params} label={appOptions.buttons.searchLbl} />
                     <IconButton onClick={handleSubmit}>
                        <SearchRounded />
                     </IconButton>
                  </Stack>
               )}
            />
            <Divider />
            <FormControlLabel
               value="Auto Layout Toggle"
               control={<Switch sx={{ ml: "auto", mr: 1 }} size="medium" onChange={autoLayout} />}
               label={appOptions.buttons.layoutLbl}
               labelPlacement="start"
            />
            <Divider />
            <FormControlLabel
               value="Legend Toggle"
               control={<Switch sx={{ ml: "auto", mr: 1 }} size="medium" onChange={toggleLegend} />}
               label="Hide Legend"
               labelPlacement="start"
            />
            <Divider />
            <Button
               variant="text"
               onClick={() => setShowOverlayUpload(true)}
               sx={{
                  borderRadius: "0px",
                  color: "#333",
                  ":hover": { backgroundColor: "#333", color: "#FFF" },
               }}
            >
               Attach Overlay
            </Button>
            <Divider />
         </Drawer>
         <OverlayUpload
            show={showOverlayUpload}
            setHideRemoveOverlayBtn={setHideRemoveOverlayBtn}
            overlayFunc={attachOverlay}
            close={() => setShowOverlayUpload(false)}
         />
         <StatsTableModal show={showTable} data={stats} close={() => setShowTable(false)} />
         <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)} />
      </Box>
   );
};

export default ActionDrawer;
