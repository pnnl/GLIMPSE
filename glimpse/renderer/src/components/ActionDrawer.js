import React, { useState, useEffect, useMemo } from "react";
import {
   Autocomplete,
   Box,
   Drawer,
   IconButton,
   Divider,
   TextField,
   Stack,
   Tooltip,
} from "@mui/material";
import { ChevronLeft, SearchRounded, TuneRounded } from "@mui/icons-material";
import OverlayUpload from "./OverlayUpload";
import StatsTableModal from "./StatsTableModal";
import PlotModal from "./PlotModal";
import axios from "axios";
import {
   CustomFab,
   CustomSwitch,
   CustomFormControlLabel,
   CustomButton,
} from "../utils/CustomComponents";
import NatigConfigModal from "./NatigConfigModal";
const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ActionDrawer = ({
   getGraphData,
   findNode,
   findEdge,
   physicsToggle,
   attachOverlay,
   removeOverlay,
   reset,
   modelNumber,
   applyOverlay,
   getSwitches,
}) => {
   const [searchOption, setSearchOption] = useState(null);
   const [showOverlayUpload, setShowOverlayUpload] = useState(false);
   const [openDrawer, setOpenDrawer] = useState(false);
   const [hideRemoveOverlayBtn, setHideRemoveOverlayBtn] = useState("none");
   const [imgUrl, setImgUrl] = useState(null);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [stats, setStats] = useState(null);
   const [openNatigConfig, setOpenNatigConfig] = useState(false);

   const graphData = getGraphData();
   const options = useMemo(
      () => [
         ...graphData.nodes.sort((a, b) => -b.type.localeCompare(a.type)),
         ...graphData.edges.sort((a, b) => -b.type.localeCompare(a.type)),
      ],
      [graphData.nodes, graphData.edges]
   );

   const handleSearch = () => {
      if (searchOption.elementType === "node") findNode(searchOption);
      else if (searchOption.elementType === "edge") findEdge(searchOption);
      else alert(`${nodeID} is not in the graph.`);
   };

   const autoLayout = (e) => {
      physicsToggle(e.target.checked);
   };

   const closeDrawer = () => {
      setOpenDrawer(false);
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
         const response = await axios.get("http://127.0.0.1:5051/get-stats");

         setStats(response.data);

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

   const toggleLegend = (e) => {
      const legend = document.getElementById("legend-network");
      const graph = document.getElementById("graph");
      const circularProgress = document.getElementById("circularProgress");
      const layoutForm = document.getElementById("layout-form");

      if (e.target.checked) {
         legend.style.display = "none";
         graph.style.width = "100%";
         circularProgress.style.left = "50%";
      } else {
         if (layoutForm.style.display === "flex") {
            layoutForm.style.display = "none";
         }
         graph.style.width = "72%";
         circularProgress.style.left = "36%";
         legend.style.display = "block";
      }
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
            <Tooltip title="Vis Options" placement="bottom-end">
               <CustomFab size="medium" variant="extended" onClick={() => setOpenDrawer(true)}>
                  <TuneRounded />
               </CustomFab>
            </Tooltip>

            <CustomFab size="medium" onClick={reset} variant="extended">
               Reset
            </CustomFab>

            <CustomFab
               size="medium"
               sx={{ display: hideRemoveOverlayBtn }}
               variant="extended"
               onClick={handleRemoveOverlay}
            >
               Remove Overlay
            </CustomFab>
         </Stack>
         <Drawer
            variant="persistent"
            anchor="left"
            open={openDrawer}
            onClose={closeDrawer}
            sx={{
               flexShrink: 0,
               [`& .MuiDrawer-paper`]: { width: 240, top: "65px", boxSizing: "border-box" },
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
               options={options}
               groupBy={(option) => option.type}
               getOptionLabel={(option) => option.id}
               onChange={(event, option) => setSearchOption(option)}
               renderInput={(params) => (
                  <Stack sx={{ m: 1 }} direction="row" spacing={1}>
                     <TextField
                        variant="outlined"
                        {...params}
                        label={appOptions.buttons.searchLbl}
                     />

                     <IconButton onClick={handleSearch}>
                        <SearchRounded />
                     </IconButton>
                  </Stack>
               )}
            />

            <Divider />

            <CustomFormControlLabel
               control={<CustomSwitch size="medium" onChange={autoLayout} />}
               label={appOptions.buttons.layoutLbl}
               labelPlacement="start"
            />

            <Divider />

            <CustomFormControlLabel
               control={<CustomSwitch size="medium" onChange={toggleLegend} />}
               label="Hide Legend"
               labelPlacement="start"
            />

            <Divider />

            <CustomButton
               sx={{ borderRadius: "0" }}
               variant="text"
               onClick={() => setShowOverlayUpload(true)}
            >
               Attach Overlay
            </CustomButton>
            <Divider />
            <CustomButton
               sx={{ borderRadius: "0" }}
               variant="text"
               onClick={() => setOpenNatigConfig(true)}
            >
               Scenario Configuration
            </CustomButton>

            <Divider />
         </Drawer>
         <OverlayUpload
            show={showOverlayUpload}
            setHideRemoveOverlayBtn={setHideRemoveOverlayBtn}
            overlayFunc={attachOverlay}
            close={() => setShowOverlayUpload(false)}
         />
         <NatigConfigModal
            open={openNatigConfig}
            close={() => setOpenNatigConfig(false)}
            modelNumber={modelNumber}
            applyOverlay={applyOverlay}
            showRemoveOverlayBtn={setHideRemoveOverlayBtn}
            getSwitches={getSwitches}
         />
         <StatsTableModal show={showTable} data={stats} close={() => setShowTable(false)} />
         <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)} />
      </Box>
   );
};

export default ActionDrawer;
