import React, { useEffect, useState } from "react";
import StatsTableModal from "./StatsTableModal";
import axios from "axios";
import {
   Button,
   ButtonGroup,
   Divider,
   Paper,
   Stack,
   ToggleButton,
   ToggleButtonGroup,
   Tooltip
} from "@mui/material";
import {
   RotateLeftSharp,
   RotateRightSharp,
   InsightsRounded,
   HideSource,
   Add,
   TableChart
} from "@mui/icons-material";

const VisToolbar = ({
   rotateCW,
   rotateCCW,
   next,
   prev,
   reset,
   legendContainerRef,
   networkContainerRef,
   layoutContainerRef,
   circularProgressRef,
   physicsToggle,
   graphData,
   setOverlay,
   removeOverlay,
   isCIM
}) => {
   const [visOptions, setVisOptions] = useState([]);
   const [showRemoveOverlay, setShowRemoveOverlay] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [stats, setStats] = useState(null);

   const handleToggleChange = (event, newOptions) => {
      if (newOptions.includes("autoLayout")) {
         physicsToggle(true);
      } else {
         physicsToggle(false);
      }

      if (newOptions.includes("hideLegend")) {
         legendContainerRef.current.style.display = "none";
         networkContainerRef.current.style.width = "100%";
         circularProgressRef.current.style.left = "50%";
      } else {
         if (layoutContainerRef.current.style.display === "flex") {
            layoutContainerRef.current.style.display = "none";
         }
         legendContainerRef.current.style.display = "block";
         networkContainerRef.current.style.width = "72%";
         circularProgressRef.current.style.left = "36%";
      }
      setVisOptions(newOptions);
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

   const handleAttachOverlay = async () => {
      const filepathsPromise = await window.glimpseAPI.getFilePaths();
      const filepaths = await filepathsPromise;
      setOverlay(filepaths, setShowRemoveOverlay);
   };

   const handleRemoveOverlay = () => {
      removeOverlay();
      setShowRemoveOverlay(false);
   };

   const openStudio = () => {
      window.glimpseAPI.openObjectStudio({
         isCIM: isCIM,
         nodes: graphData.nodes.get(),
         edges: graphData.edges.get()
      });
   };

   useEffect(() => {
      const removeListenersArr = [];
      removeListenersArr.push(window.glimpseAPI.onGetMetrics(showStats));

      return () => {
         for (let removeListener of removeListenersArr) {
            removeListener();
         }
      };
   });

   return (
      <>
         <Paper
            sx={{
               display: "flex",
               height: "3.5rem",
               with: "100%",
               padding: "0.5rem",
               m: "0.5rem 1rem"
            }}
            elevation={2}
         >
            <Stack width={"100%"} spacing={1} justifyContent={"space-between"} direction={"row"}>
               <Stack
                  direction={"row"}
                  spacing={1}
                  divider={<Divider orientation="vertical" flexItem />}
               >
                  <Tooltip title="Add an Overlay">
                     <Button
                        onClick={handleAttachOverlay}
                        color="#333333"
                        variant="outlined"
                        size="small"
                     >
                        <Add />
                     </Button>
                  </Tooltip>

                  <Tooltip title="Open Studio">
                     <Button color="#333333" variant="outlined" size="small" onClick={openStudio}>
                        <TableChart />
                     </Button>
                  </Tooltip>

                  <ToggleButtonGroup value={visOptions} onChange={handleToggleChange}>
                     <Tooltip title="Auto Layout">
                        <ToggleButton value={"autoLayout"}>
                           <InsightsRounded />
                        </ToggleButton>
                     </Tooltip>
                     <ToggleButton value={"hideLegend"}>
                        <Tooltip title="Hide Legend">
                           <HideSource />
                        </Tooltip>
                     </ToggleButton>
                  </ToggleButtonGroup>
               </Stack>
               <Stack
                  direction={"row"}
                  spacing={1}
                  divider={<Divider orientation="vertical" flexItem />}
               >
                  {showRemoveOverlay && (
                     <Button
                        color="#333333"
                        variant="outlined"
                        size="small"
                        onClick={handleRemoveOverlay}
                     >
                        Remove Overlay
                     </Button>
                  )}
                  <ButtonGroup color="#333333" variant="outlined" size="small">
                     <Tooltip title="Rotate CCW">
                        <Button onClick={rotateCCW}>
                           <RotateLeftSharp />
                        </Button>
                     </Tooltip>

                     <Tooltip title="Rotate CW">
                        <Button onClick={rotateCW}>
                           <RotateRightSharp />
                        </Button>
                     </Tooltip>
                  </ButtonGroup>
                  <ButtonGroup color="#333333" variant="outlined" size="small">
                     <Button onClick={prev}>Prev</Button>
                     <Button onClick={next}>Next</Button>
                  </ButtonGroup>
                  <Button color="#333333" variant="outlined" size="small" onClick={reset}>
                     Reset
                  </Button>
               </Stack>
            </Stack>
         </Paper>
         <StatsTableModal show={showTable} data={stats} close={() => setShowTable(false)} />
      </>
   );
};

export default VisToolbar;
