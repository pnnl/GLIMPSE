import React, { useState } from "react";
import axios from "axios";
import PlotModal from "./PlotModal";
import OverlayUpload from "./OverlayUpload";
import { socket } from "./config/socket";
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
import StatsTableModal from "../App/StatsTableModal.js";

const appOptions = appConfig.appOptions;

const SearchBar = ({
   data, 
   objCounts, 
   onFind, 
   download, 
   reset, 
   updateData, 
   prev, 
   next, 
   physicsToggle, 
   addGraphOverlay }) => {

   const nodes = data;
   const [node, setNode] = useState(null);
   const [stats, setStats] = useState(null);
   const [imgUrl, setImgUrl] = useState(null);
   const [checked, setChecked] = useState(false);
   const [showPlot, setShowPlot] = useState(false);
   const [showTable, setShowTable] = useState(false);
   const [showUpload, setShowUpload] = useState(false);
   const [anchorElement, setAnchorElement] = useState(null);
   const [edgeCheckboxes, setEdgeCheckboxes] = useState(
      Object.fromEntries(Object.entries(objCounts.edges).filter(([key, val]) => val > 0).map(obj => [obj[0], true]))
   );
   const [nodeCheckboxes, setNodeCheckboxes] = useState(  
      Object.fromEntries(Object.entries(objCounts.nodes).filter(([key, val]) => val > 0).map(obj => [obj[0], true]))
   );
   const [nodesParentChecked, setNodesParentChecked] = useState(true);
   const [edgesParentChecked, setEdgesParentChecked] = useState(true);
   const [nodeIndeterminate, setNodeIndeterminate] = useState(false);
   const [edgeIndeterminate, setEdgeIndeterminate] = useState(false);

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
   
   const handleChange = (e) =>
   {
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
         await axios.get(appOptions.serverUrl + "/getplot", {responseType: "blob" }).then(({ data: blob }) => {
            let imageUrl = URL.createObjectURL(blob);
            setImgUrl(imageUrl);
            setShowPlot(true);
         })
         .catch(( err ) => console.log( err ))
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
         await axios.get(appOptions.serverUrl + "/getstats").then((res) => {
            console.log(res.data);
            setStats(res.data);
            setShowTable(true);
         })
         .catch(( err ) => console.log( err ));
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

   const establishConn = async () => {
      socket.connect();

      socket.on("connect", () => {
         console.log("connected to socket server");
      })

      socket.on("message", (msg) => {
         updateData(msg);
      })

      await axios.get(appOptions.serverUrl + "/simdata").catch(( err ) => console.log( err ))
   }

   const handleEdgeChecked = (e) => {
      setEdgeCheckboxes({...edgeCheckboxes, [e.target.value]: e.target.checked});
   }

   const handleNodeChecked = (e) => {
      setNodeCheckboxes({...nodeCheckboxes, [e.target.value]: e.target.checked});
   }

   const handleParentNodesCheck = (e) => {
      setNodesParentChecked(e.target.checked);
      Object.keys(nodeCheckboxes).forEach(key => {
         nodeCheckboxes[key] = e.target.checked;
      });  
   }

   const handleParentEdgeCheck = (e) => {
      setEdgesParentChecked(e.target.checked);
      Object.keys(edgeCheckboxes).forEach(key => {
         edgeCheckboxes[key] = e.target.checked;
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
                        indeterminate={nodeIndeterminate}
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
                        indeterminate={edgeIndeterminate}
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

                  <Button
                     size="small"
                     variant="outlined"
                     color="primary"
                     disabled
                     onClick={establishConn}>
                     {appOptions.buttons.simBtn}
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

export default SearchBar;