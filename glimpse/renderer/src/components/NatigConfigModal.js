import React, { useState } from "react";
import ReactDOM from "react-dom";
import {
   Accordion,
   AccordionSummary,
   Dialog,
   DialogActions,
   DialogContent,
   DialogTitle,
   Divider,
   FormControl,
   InputAdornment,
   InputLabel,
   MenuItem,
   Select,
   Stack,
   TextField,
   Tooltip,
} from "@mui/material";

import { ExpandMore } from "@mui/icons-material";
import { CustomButton, CustomFormControlLabel, CustomSwitch } from "../utils/CustomComponents";
import { sendNatigConfig } from "../utils/webSocketClientUtils";
import { Box } from "@mui/system";

const packetSizeOptions = [500, 1280, 1500];
const topologyNames = ["mesh", "ring"];
const rates = ["100Kbps", "500Kbps", "10Mbps", "80Mbps", "100Mbps", "500Mbps", "1Gbps", "10Gbps"];
const nodeTypes = ["Microgrid", "Communication Node", "Control Center"];

const NatigConfigModal = ({ open, close, modelNumber, applyOverlay, showRemoveOverlayBtn }) => {
   const [expanded, setExpanded] = useState(false);
   const [topology, setTopology] = useState({ name: "" });
   const [generalConfig, setGeneralConfig] = useState({
      SimTime: {
         label: "Simulation Time",
         desc: "Controls how long the simulation is going to run in seconds.",
         value: 0,
      },
      PollReqFreq: {
         label: "Frequency",
         desc: "How long do you want to wait between poll request in milliseconds.",
         value: 0,
      },
      UseDynTop: {
         label: "Custom Topology",
         desc: "Do you want to use your own topology",
         value: false,
      },
      MonitorPer: {
         label: "Generate PCAP",
         desc: "Do you want to generate PCAP file for traffic information",
         value: false,
      },
      StaticSeed: {
         label: "Use Seed",
         desc: "Use a random seed or check to input your own",
         value: false,
      },
      RandomSeed: {
         label: "Seed",
         desc: "input a seed",
         value: 0,
      },
   });
   const [DDosConfig, setDDosConfig] = useState({
      Active: {
         label: "Enable DDoS Attack",
         desc: "Controls whether or not the DDoS attack will be active for the simulation",
         value: false,
      },
      threadsPerAttacker: {
         label: "Number of Attackers",
         desc: "Control the number of attackers",
         value: 2,
      },
      Start: {
         label: "Start",
         desc: "Number of seconds after the start of the simulation when the attack starts",
         value: 2,
      },
      End: {
         label: "End",
         desc: "Number of seconds after the start of the simulation when the attack stops",
         value: 4,
      },
      PacketSize: {
         label: "Packet Size",
         desc: "Controls the maximum transmissible unit the attackers link is set to",
         value: 1500,
      },
      Rate: {
         label: "Rate",
         desc: "bytes sent per second by the attacker",
         value: "80Mbps",
      },
      NodeType: {
         label: "DDoS Entry Point",
         desc: "The type of node that the DDoS will be connected to",
         value: "Microgrid",
      },
      endPoint: {
         label: "DDoS End Point",
         desc: "The type of node that will be targeted by the bot's application",
         value: "Communication Node",
      },
   });

   const handleGeneralConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setGeneralConfig({
         ...generalConfig,
         [name]: {
            ...generalConfig[name],
            value: type === "checkbox" ? checked : value,
         },
      });
   };

   const handleDDosConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setDDosConfig({
         ...DDosConfig,
         [name]: {
            ...DDosConfig[name],
            value: type === "checkbox" ? checked : value,
         },
      });
   };

   const handleTopologySelect = async (e) => {
      const { value: topoName } = e.target;

      if (modelNumber) {
         const response = await fetch(`../topologies/feeder_${modelNumber}/${topoName}.json`);
         setTopology({ name: topoName, data: await response.json() });
      } else {
         setTopology({ name: topoName });
      }
   };

   const getSendObj = (formConfigObj) => {
      return Object.entries(formConfigObj).reduce(
         (o, [key, val]) => ({ ...o, [key]: val.value }),
         {}
      );
   };

   const send = () => {
      if ("data" in topology) {
         if (topology.data.Node.every((node) => typeof node.name === "number")) {
            topology.data.Node.map((commNode) => {
               commNode.name = `comm${commNode.name + 1}`;
               commNode.connections = commNode.connections.map((id) => `comm${id + 1}`);
            });
         }
         const natigGeneralConfig = {
            modelNumber: modelNumber,
            ...getSendObj(generalConfig),
            ...getSendObj(DDosConfig),
            topology: { ...topology },
         };

         console.log(natigGeneralConfig);

         sendNatigConfig(natigGeneralConfig);

         close();
      } else {
         alert("Upload a feeder model ex: ieee3000_Feeder3.glm");
      }
   };

   const handleExpand = (panelName) => (e, isExpanded) => {
      setExpanded(isExpanded ? panelName : false);
   };

   const appyTopology = async () => {
      showRemoveOverlayBtn("flex");
      await applyOverlay(undefined, modelNumber, topology.data);
   };

   return ReactDOM.createPortal(
      <>
         <Dialog fullWidth open={open}>
            <DialogTitle
               sx={{ color: "#ffffff", backgroundColor: "rgba(51,51,51, 0.8)", fontWeight: "bold" }}
            >
               Model and Scenario Setup
            </DialogTitle>
            <DialogContent dividers>
               <Stack direction={"row"} spacing={1}>
                  <Tooltip title={"Choose a topology for uploaded model"} placement="left" arrow>
                     <FormControl fullWidth>
                        <InputLabel>Topology</InputLabel>
                        <Select
                           label={"Topology"}
                           name={"topology"}
                           value={topology.name}
                           onChange={handleTopologySelect}
                        >
                           {topologyNames.map((name, index) => (
                              <MenuItem key={index} value={name}>
                                 {name}
                              </MenuItem>
                           ))}
                        </Select>
                     </FormControl>
                  </Tooltip>
                  <Tooltip title={"Apply topology to visualization"} placement="right" arrow>
                     <CustomButton onClick={appyTopology}>Apply</CustomButton>
                  </Tooltip>
               </Stack>
               <Divider sx={{ m: "0.5rem 0" }} />
               <Accordion
                  expanded={expanded === "General Settings"}
                  onChange={handleExpand("General Settings")}
               >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                     Simulation Settings
                  </AccordionSummary>
                  <Stack sx={{ margin: "1rem" }} direction={"column"} spacing={1}>
                     <Tooltip title={generalConfig.SimTime.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={generalConfig.SimTime.value}
                           name="SimTime"
                           label={generalConfig.SimTime.label}
                           onChange={handleGeneralConfig}
                           type="number"
                           slotProps={{
                              input: {
                                 endAdornment: (
                                    <InputAdornment position="end">Seconds</InputAdornment>
                                 ),
                              },
                           }}
                        />
                     </Tooltip>
                     <Tooltip title={generalConfig.PollReqFreq.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={generalConfig.PollReqFreq.value}
                           name="PollReqFreq"
                           type="number"
                           label={generalConfig.PollReqFreq.label}
                           onChange={handleGeneralConfig}
                           slotProps={{
                              input: {
                                 endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                              },
                           }}
                        />
                     </Tooltip>
                     <Tooltip title={generalConfig.UseDynTop.desc} placement="left" arrow>
                        <CustomFormControlLabel
                           control={
                              <CustomSwitch
                                 name={"UseDynTop"}
                                 checked={generalConfig.UseDynTop.value}
                                 value={generalConfig.UseDynTop.value}
                                 size="medium"
                                 onChange={handleGeneralConfig}
                              />
                           }
                           label={generalConfig.UseDynTop.label}
                           labelPlacement="start"
                        />
                     </Tooltip>
                     <Tooltip title={generalConfig.MonitorPer.desc} placement="left" arrow>
                        <CustomFormControlLabel
                           control={
                              <CustomSwitch
                                 name={"MonitorPer"}
                                 checked={generalConfig.MonitorPer.value}
                                 value={generalConfig.MonitorPer.value}
                                 size="medium"
                                 onChange={handleGeneralConfig}
                              />
                           }
                           label={generalConfig.MonitorPer.label}
                           labelPlacement="start"
                        />
                     </Tooltip>
                     <Tooltip title={generalConfig.StaticSeed.desc} placement="left" arrow>
                        <CustomFormControlLabel
                           control={
                              <CustomSwitch
                                 name={"StaticSeed"}
                                 checked={generalConfig.StaticSeed.value}
                                 value={generalConfig.StaticSeed.value}
                                 size="medium"
                                 onChange={handleGeneralConfig}
                              />
                           }
                           label={generalConfig.StaticSeed.label}
                           labelPlacement="start"
                        />
                     </Tooltip>
                     {generalConfig.StaticSeed.value && (
                        <Tooltip title={generalConfig.RandomSeed.desc} placement="left" arrow>
                           <TextField
                              variant="outlined"
                              value={generalConfig.RandomSeed.value}
                              name="RandomSeed"
                              type="number"
                              label={generalConfig.RandomSeed.label}
                              onChange={handleGeneralConfig}
                           />
                        </Tooltip>
                     )}
                  </Stack>
               </Accordion>

               <Divider sx={{ m: "0.5rem 0" }} />
               <Accordion
                  expanded={expanded === "DDoS Settings"}
                  onChange={handleExpand("DDoS Settings")}
               >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                     Attack Scenario Settings
                  </AccordionSummary>
                  <Tooltip title={DDosConfig.Active.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        sx={{ width: "100%", padding: "0 3rem" }}
                        control={
                           <CustomSwitch
                              name={"Active"}
                              checked={DDosConfig.Active.value}
                              value={DDosConfig.Active.value}
                              size="medium"
                              onChange={handleDDosConfig}
                           />
                        }
                        label={DDosConfig.Active.label}
                        labelPlacement="start"
                     />
                  </Tooltip>
                  <Box
                     component={"form"}
                     sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-evenly",
                        mb: 1,
                        "& .MuiTextField-root": { mt: 1, width: "13rem", height: "3.5rem" },
                     }}
                  >
                     {DDosConfig.Active.value && (
                        <>
                           <Tooltip title={DDosConfig.Start.desc} placement="left" arrow>
                              <TextField
                                 variant="outlined"
                                 value={DDosConfig.Start.value}
                                 name="Start"
                                 type="number"
                                 label={DDosConfig.Start.label}
                                 onChange={handleDDosConfig}
                              />
                           </Tooltip>
                           <Tooltip title={DDosConfig.End.desc} placement="left" arrow>
                              <TextField
                                 variant="outlined"
                                 value={DDosConfig.End.value}
                                 name="End"
                                 type="number"
                                 label={DDosConfig.End.label}
                                 onChange={handleDDosConfig}
                              />
                           </Tooltip>
                           <Tooltip
                              title={DDosConfig.threadsPerAttacker.desc}
                              placement="left"
                              arrow
                           >
                              <TextField
                                 variant="outlined"
                                 value={DDosConfig.threadsPerAttacker.value}
                                 name="threadsPerAttacker"
                                 type="number"
                                 label={DDosConfig.threadsPerAttacker.label}
                                 onChange={handleDDosConfig}
                              />
                           </Tooltip>
                           <Tooltip title={DDosConfig.PacketSize.desc} placement="left" arrow>
                              <TextField
                                 select
                                 label={DDosConfig.PacketSize.label}
                                 name={"PacketSize"}
                                 value={DDosConfig.PacketSize.value}
                                 onChange={handleDDosConfig}
                              >
                                 {packetSizeOptions.map((size, index) => (
                                    <MenuItem key={index} value={size}>
                                       {`${size} bytes`}
                                    </MenuItem>
                                 ))}
                              </TextField>
                           </Tooltip>
                           <Tooltip title={DDosConfig.Rate.desc} placement="left" arrow>
                              <TextField
                                 select
                                 label={DDosConfig.Rate.label}
                                 name={"Rate"}
                                 value={DDosConfig.Rate.value}
                                 onChange={handleDDosConfig}
                              >
                                 {rates.map((rate, index) => (
                                    <MenuItem key={index} value={rate}>
                                       {rate}
                                    </MenuItem>
                                 ))}
                              </TextField>
                           </Tooltip>
                           <Tooltip title={DDosConfig.NodeType.desc} placement="left" arrow>
                              <TextField
                                 select
                                 label={DDosConfig.NodeType.label}
                                 name={"NodeType"}
                                 value={DDosConfig.NodeType.value}
                                 onChange={handleDDosConfig}
                              >
                                 {nodeTypes.map((type, index) => (
                                    <MenuItem key={index} value={type}>
                                       {type}
                                    </MenuItem>
                                 ))}
                              </TextField>
                           </Tooltip>
                           <Tooltip title={DDosConfig.endPoint.desc} placement="left" arrow>
                              <TextField
                                 select
                                 label={DDosConfig.endPoint.label}
                                 value={DDosConfig.endPoint.value}
                                 name={"endPoint"}
                                 onChange={handleDDosConfig}
                              >
                                 {nodeTypes.map((type, index) => (
                                    <MenuItem
                                       disabled={type === DDosConfig.NodeType.value}
                                       key={index}
                                       value={type}
                                    >
                                       {type}
                                    </MenuItem>
                                 ))}
                              </TextField>
                           </Tooltip>
                        </>
                     )}
                  </Box>
               </Accordion>
            </DialogContent>
            <DialogActions>
               <CustomButton onClick={send}>Send</CustomButton>
               <CustomButton onClick={close}>close</CustomButton>
            </DialogActions>
         </Dialog>
      </>,
      document.getElementById("portal")
   );
};

export default NatigConfigModal;
