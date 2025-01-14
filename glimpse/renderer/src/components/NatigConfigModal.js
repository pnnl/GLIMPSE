import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
   Accordion,
   AccordionSummary,
   Dialog,
   DialogActions,
   DialogContent,
   DialogTitle,
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

const packetSizeOptions = [500, 1280, 1500];

const NatigConfigModal = ({ onMount }) => {
   const [openForm, setOpenForm] = useState(false);
   const [expanded, setExpanded] = useState(false);
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
         value: 0,
      },
      Start: {
         label: "Start",
         desc: "Number of seconds after the start of the simulation when the attack starts",
         value: 0,
      },
      End: {
         label: "End",
         desc: "Number of seconds after the start of the simulation when the attack stops",
         value: 0,
      },
      PacketSize: {
         label: "Packet Size",
         desc: "Controls the maximum transmissible unit the attackers link is set to",
         value: 500,
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

   const getSendObj = (formConfigObj) => {
      return Object.entries(formConfigObj).reduce(
         (o, [key, val]) => ({ ...o, [key]: val.value }),
         {}
      );
   };

   const send = () => {
      const natigGeneralConfig = {
         ...getSendObj(generalConfig),
         ...getSendObj(DDosConfig),
      };

      console.log(natigGeneralConfig);

      sendNatigConfig(natigGeneralConfig);
   };

   const handleExpand = (panelName) => (e, isExpanded) => {
      setExpanded(isExpanded ? panelName : false);
   };

   useEffect(() => {
      onMount(setOpenForm);
   }, [onMount]);

   return ReactDOM.createPortal(
      <>
         <Dialog open={openForm}>
            <DialogTitle>NATIG Configuration</DialogTitle>
            <DialogContent dividers>
               <Accordion
                  expanded={expanded === "General Settings"}
                  onChange={handleExpand("General Settings")}
               >
                  <AccordionSummary expandIcon={<ExpandMore />}>General Settings</AccordionSummary>
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
               <Accordion
                  expanded={expanded === "DDoS Settings"}
                  onChange={handleExpand("DDoS Settings")}
               >
                  <AccordionSummary expandIcon={<ExpandMore />}>DDoS Settings</AccordionSummary>
                  <Stack sx={{ margin: "1rem" }} direction={"column"} spacing={1}>
                     <Tooltip title={DDosConfig.Active.desc} placement="left" arrow>
                        <CustomFormControlLabel
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
                              <FormControl>
                                 <InputLabel>{DDosConfig.PacketSize.label}</InputLabel>
                                 <Select
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
                                 </Select>
                              </FormControl>
                           </Tooltip>
                        </>
                     )}
                  </Stack>
               </Accordion>
            </DialogContent>
            <DialogActions>
               <CustomButton onClick={send}>Send</CustomButton>
               <CustomButton onClick={() => setOpenForm(false)}>close</CustomButton>
            </DialogActions>
         </Dialog>
      </>,
      document.getElementById("portal")
   );
};

export default NatigConfigModal;
