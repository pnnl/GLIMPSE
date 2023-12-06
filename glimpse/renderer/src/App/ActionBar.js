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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from "@mui/material/Switch";
import SearchIcon from "@mui/icons-material/Search";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Menu from "@mui/material/Menu";
import appConfig from "../appConfig/appConfig.json";
import StatsTableModal from "./StatsTableModal.js";

const appOptions = appConfig.appOptions;

const ActionBar = ({
   nodesDataObj,
   graphDataObj, 
   objCounts, 
   onFind, 
   download, 
   reset,
   prev, 
   next, 
   physicsToggle, 
   addGraphOverlay,
   updateNodeFilterVals,
   updateEdgeFilterVals, 
   edgeCheckboxValues,
   nodeCheckboxValues }) => {

   const nodes = nodesDataObj;
   const [node, setNode] = useState(null);
   const [stats, setStats] = useState(null);
   const [imgUrl, setImgUrl] = useState(null);
   const [checked, setChecked] = useState(false);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [showUpload, setShowUpload] = useState(false);
   const [anchorElement, setAnchorElement] = useState(null);
   const [nodeCheckboxes, setNodeCheckboxes] = useState(nodeCheckboxValues);
   const [edgeCheckboxes, setEdgeCheckboxes] = useState(edgeCheckboxValues);
   const [nodesParentChecked, setNodesParentChecked] = useState(true);
   const [edgesParentChecked, setEdgesParentChecked] = useState(true);

   const open = Boolean(anchorElement);
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

   const handleFilterClick = (e) => {
      setAnchorElement(e.currentTarget);
   }
   
   const handleChange = (e) => {
      setNode(e.target.value);
   }

   const handleSubmit = (e) =>
   {
      e.preventDefault();
      
      if (nodes.get(node))
      {
         onFind(node);
      }
      else
      {
         alert(`${node} is not in the graph.`)
      }
   }

   const handleExport = (e) => {
      e.preventDefault()
      download();
   }

   const handleReset = (e) =>
   {
      e.preventDefault();
      reset();
   }

   const handlePrev = (e) => 
   {
      e.preventDefault();
      prev();
   }

   const handleNext = (e) =>
   {
      e.preventDefault();
      next();
   }

   const autoLayout = (e) =>
   {
      physicsToggle(e.target.checked);
      setChecked(e.target.checked)
   }

   const plot = async (e) => 
   {
      e.preventDefault();
      
      if(imgUrl === null)
      {
         // getPlot returns a Uint8Array of the png
         const plot = await window.glimpseAPI.getPlot();
         const imgUrl = URL.createObjectURL(
            new Blob([plot.buffer], {type: "image/png"})
         );

         setImgUrl(imgUrl);
         setShowPlot(true);
      }
      else
      {
         setShowPlot(true);
      }
   }

   const showStats = async (e) => {
      e.preventDefault();

      if(stats === null)
      {
         const statsObj = await window.glimpseAPI.getStats(JSON.stringify(graphDataObj));
         setStats(JSON.parse(statsObj));
         setShowTable(true);
      }
      else
      {
         setShowTable(true);
      }
   }

   const showOverlay = (e) => {

      e.preventDefault();
      setShowUpload(true)
   }

   const handleEdgeChecked = (e) => {
      setEdgeCheckboxes({...edgeCheckboxes, [e.target.value]: e.target.checked});
      updateEdgeFilterVals({value: e.target.value, checked: e.target.checked});
   }
   
   const handleNodeChecked = (e) => {
      setNodeCheckboxes({...nodeCheckboxes, [e.target.value]: e.target.checked});
      updateNodeFilterVals({value: e.target.value, checked: e.target.checked});
   }

   const handleParentNodesCheck = (e) => {
      setNodesParentChecked(e.target.checked);
      Object.keys(nodeCheckboxes).forEach(key => {
         nodeCheckboxes[key] = e.target.checked;
         updateNodeFilterVals({value: key, checked: e.target.checked});
      });
   }

   const handleParentEdgeCheck = (e) => {
      setEdgesParentChecked(e.target.checked);
      Object.keys(edgeCheckboxes).forEach(key => {
         edgeCheckboxes[key] = e.target.checked;
         updateEdgeFilterVals({value: key, checked: e.target.checked});
      });
   }

   const nodesCheckboxes = (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
         {
            Object.entries(nodeCheckboxes).map(([key, val], index) => {
               return (
                  <FormControlLabel
                     key={index}
                     label={key}
                     control={
                        <Checkbox 
                           value={key} 
                           key={index} 
                           checked={val} 
                           onChange={handleNodeChecked}
                        />
                     }
                  />
               );
            })
         }
      </Box>
   );

   const edgesCheckboxes = (
      <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
         {
            Object.entries(edgeCheckboxes).map(([key, val], index) => {
               return (
                  <FormControlLabel
                     label={key}
                     key={index}
                     control={
                        <Checkbox 
                           value={key} 
                           key={index} 
                           checked={val} 
                           onChange={handleEdgeChecked}
                        />
                     }
                  />
               );
            })
         }
      </Box>
   );

   return (
      <>
      <Box sx={{m: 1, display: "flex", flexDirection: "row", justifyContent: "end"}}>
         <ThemeProvider theme={theme}>
               <Stack direction="row" spacing={1} sx={{marginRight: "auto"}}>
                  <Button
                     id="filter-button"
                     aria-controls={open ? "filter-form" : undefined}
                     aria-haspopup="true"
                     aria-expanded={open ? "true" : undefined}
                     variant="contained"
                     disableElevation
                     onClick={handleFilterClick}
                     endIcon={<KeyboardArrowDownIcon />}
                     disabled
                     >
                     {appOptions.buttons.filterBtn}
                  </Button>
                  <Menu
                     elevation={0}
                     anchorOrigin={{vertical: "bottom", horizontal: "right",}}
                     transformOrigin={{vertical: "top", horizontal: "right"}}
                     id="filter-form"
                     MenuListProps={{"aria-labelledby": "filter-button"}}
                     anchorEl={anchorElement}
                     open={open}
                     onClose={() => setAnchorElement(null)}
                  >
                  <FormControlLabel
                  label="Nodes"
                  control={
                     <Checkbox
                        checked={nodesParentChecked}
                        onChange={handleParentNodesCheck}
                     />
                  }
                  />
                  {nodesCheckboxes}
                  <FormControlLabel
                  label="Edges"
                  control={
                     <Checkbox
                        checked={edgesParentChecked}
                        onChange={handleParentEdgeCheck}
                     />
                  }
                  />
                  {edgesCheckboxes}
                  </Menu>

                  <Button 
                     size="small"
                     variant="outlined"
                     color="primary"
                     onClick={handleExport}>
                     {appOptions.buttons.exportBtn}
                  </Button>

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

               <TextField 
                  id="outlined-basic" 
                  label={appOptions.buttons.searchLbl} 
                  variant="outlined"
                  size="small"
                  onChange={handleChange}
                  sx={{width: "10rem"}}
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
               </Stack>
         </ThemeProvider>
      </Box>
      <StatsTableModal show = {showTable} data = {stats} close={() => setShowTable(false)}/>
      <OverlayUpload show = {showUpload} overlayFunc = {addGraphOverlay} close={() => setShowUpload(false)}/>
      <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)}/>
      </>
   );
}

export default ActionBar;