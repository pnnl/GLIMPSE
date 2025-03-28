import * as React from "react";
import { useState, useEffect } from "react";
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
   Autocomplete,
   Box,
   FormLabel,
} from "@mui/material";

import { ExpandMore } from "@mui/icons-material";
import { CustomButton, CustomFormControlLabel, CustomSwitch } from "../utils/CustomComponents";
import { sendNatigConfig } from "../utils/webSocketClientUtils";

const packetSizeOptions = [500, 1280, 1500];
const topologyNames = ["mesh", "ring"];
const rates = ["100Kbps", "500Kbps", "10Mbps", "80Mbps", "100Mbps", "500Mbps", "1Gbps", "10Gbps"];
const nodeTypes = ["Microgrid", "Communication Node", "Control Center"];

const NatigConfigModal = ({
   open,
   close,
   modelNumber,
   applyOverlay,
   showRemoveOverlayBtn,
   getSwitches,
}) => {
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

   const [MIMConfig, setMIMConfig] = useState({
      includeMIM: {
         label: "Enable MIM Attack",
         desc: "Controls whether or not the MIM attack will be active during the simulation",
         value: false,
      },
      ListOfAttackedSwitches: {
         label: "Enter ID of nodes that are under attacked",
         desc: "List the IDs as represented in gridlabd of the nodes that will be attacked",
         value: [],
      },
      StartOfAttack: {
         label: "Start",
         desc: "Start of the Attack",
      },
      EndOfAttack: {
         label: "End",
         desc: "This list should contain when you want the attack to end",
      },
      AttackPoint: {
         label: "Attack Point",
         desc: "Where to attack",
      },
      AttackValue: {
         label: "Attack Value",
         desc: "What value the attacker sets during the attack",
      },
      RealValue: {
         label: "Real Value",
         desc: "What value should the point be set to after the attack. NA means it will keep the same value as the one set during the attack",
      },
      isInt: {
         label: "Attack Type",
         desc: "Is the attack value an integer",
      },
   });

   const switches = getSwitches();

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

   const handleValueChange = (e, switchId) => {
      const { name, value } = e.target;

      // Update the specific switch object in the ListOfAttackedSwitches array
      const updatedSwitches = MIMConfig.ListOfAttackedSwitches.value.map((swObj) =>
         swObj.id === switchId ? { ...swObj, [name]: value } : swObj
      );

      // Update the state with the modified array
      setMIMConfig({
         ...MIMConfig,
         ListOfAttackedSwitches: {
            ...MIMConfig.ListOfAttackedSwitches,
            value: updatedSwitches,
         },
      });
   };

   const handleMIMConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setMIMConfig({
         ...MIMConfig,
         [name]: {
            ...MIMConfig[name],
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

   const handleSwitchesSelect = (switches) => {
      const currentSwitches = MIMConfig.ListOfAttackedSwitches.value;

      if (currentSwitches.length === 0) {
         setMIMConfig({
            ...MIMConfig,
            ListOfAttackedSwitches: {
               ...MIMConfig.ListOfAttackedSwitches,
               value: switches.map((id) => ({
                  id: id,
                  start: 0,
                  end: 0,
                  attackPoint: "",
                  attackValue: "",
                  realValue: "",
                  isInt: "",
               })),
            },
         });
      } else if (switches.length > currentSwitches.length) {
         const newSwitches = switches.filter(
            (id) => !currentSwitches.find((swObj) => swObj.id === id)
         );

         setMIMConfig({
            ...MIMConfig,
            ListOfAttackedSwitches: {
               ...MIMConfig.ListOfAttackedSwitches,
               value: [
                  ...currentSwitches,
                  ...newSwitches.map((id) => ({
                     id: id,
                     start: 0,
                     end: 0,
                     attackPoint: "",
                     attackValue: "",
                     realValue: "",
                     isInt: "",
                  })),
               ],
            },
         });
      } else {
         const removedSwitches = currentSwitches.filter((swObj) => !switches.includes(swObj.id));

         setMIMConfig({
            ...MIMConfig,
            ListOfAttackedSwitches: {
               ...MIMConfig.ListOfAttackedSwitches,
               value: currentSwitches.filter((swObj) => !removedSwitches.includes(swObj)),
            },
         });
      }
   };

   const getSendObj = (formConfigObj) => {
      return Object.entries(formConfigObj).reduce(
         (o, [key, val]) => ({ ...o, [key]: val.value }),
         {}
      );
   };

   const getMIMSendObj = () => {
      if (!MIMConfig.includeMIM.value) {
         return {
            includeMIM: MIMConfig.includeMIM.value,
         };
      }

      const switchesObjs = MIMConfig.ListOfAttackedSwitches.value;

      const sendSwitchesList = switchesObjs.map((swObj) => swObj.id);
      const sendStartTimes = switchesObjs.map((swObj) => swObj.start);
      const sendEndTimes = switchesObjs.map((swObj) => swObj.end);
      const sendAttackPoints = switchesObjs.map((swObj) => swObj.attackPoint);
      const sendAttackValues = switchesObjs.map((swObj) => swObj.attackValue);
      const sendRealValues = switchesObjs.map((swObj) => swObj.realValue);
      const sendAttckScenario = switchesObjs.map((swObj) => swObj.isInt);

      return {
         includeMIM: MIMConfig.includeMIM.value,
         StartOfAttack: sendStartTimes.join(","),
         EndOfAttack: sendEndTimes.join(","),
         AttackPoint: sendAttackPoints.join(","),
         AttackValue: sendAttackValues.join(","),
         RealValue: sendRealValues.join(","),
         attackType: sendAttckScenario.join(","),
         ListOfAttackedSwitches: sendSwitchesList.join(","),
      };
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
            ...getMIMSendObj(),
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
                  <Tooltip title={MIMConfig.includeMIM.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        control={
                           <CustomSwitch
                              name={"includeMIM"}
                              checked={MIMConfig.includeMIM.value}
                              value={MIMConfig.includeMIM.value}
                              size="medium"
                              onChange={handleMIMConfig}
                           />
                        }
                        label={MIMConfig.includeMIM.label}
                        labelPlacement="start"
                     />
                  </Tooltip>
                  {MIMConfig.includeMIM.value && (
                     <Box
                        sx={{
                           m: 1,
                           display: "flex",
                           flexDirection: "column",
                        }}
                     >
                        <Tooltip
                           title={MIMConfig.ListOfAttackedSwitches.desc}
                           placement="left"
                           arrow
                        >
                           <Autocomplete
                              sx={{ padding: "0 1.5rem", margin: "0 0 1rem 0" }}
                              size="small"
                              fullWidth
                              multiple
                              limitTags={3}
                              options={switches}
                              value={MIMConfig.ListOfAttackedSwitches.value.map(
                                 (swObj) => swObj.id
                              )}
                              onChange={(e, selectedSwitches) =>
                                 handleSwitchesSelect(selectedSwitches)
                              }
                              renderInput={(params) => (
                                 <TextField
                                    {...params}
                                    size="small"
                                    label="Select Switches To Attack"
                                 />
                              )}
                           />
                        </Tooltip>
                        {MIMConfig.ListOfAttackedSwitches.value.length > 0 && (
                           <>
                              {MIMConfig.ListOfAttackedSwitches.value.map((switchObj, index) => (
                                 <Accordion
                                    slotProps={{ transition: { unmountOnExit: true } }}
                                    key={index}
                                 >
                                    <AccordionSummary expandIcon={<ExpandMore />}>
                                       {switchObj.id}
                                    </AccordionSummary>
                                    <Stack
                                       spacing={1}
                                       sx={{
                                          padding: 1,
                                          flexWrap: "wrap",
                                          justifyContent: "center",
                                          "& .MuiTextField-root": { width: "13rem" },
                                       }}
                                       direction={"row"}
                                       useFlexGap
                                    >
                                       <TextField
                                          size="small"
                                          type="number"
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.start}
                                          name="start"
                                          label={MIMConfig.StartOfAttack.label}
                                       />
                                       <TextField
                                          size="small"
                                          type="number"
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.end}
                                          name="end"
                                          label={MIMConfig.EndOfAttack.label}
                                       />
                                       <TextField
                                          size="small"
                                          select
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.attackPoint}
                                          name="attackPoint"
                                          label={MIMConfig.AttackPoint.label}
                                       >
                                          <MenuItem value="status">status</MenuItem>
                                       </TextField>
                                       <TextField
                                          size="small"
                                          select
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.attackValue}
                                          name="attackValue"
                                          label={MIMConfig.AttackValue.label}
                                       >
                                          <MenuItem value="TRIP">TRIP</MenuItem>
                                       </TextField>
                                       <TextField
                                          size="small"
                                          select
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.realValue}
                                          name="realValue"
                                          label={MIMConfig.RealValue.label}
                                       >
                                          <MenuItem value="NA">NA</MenuItem>
                                          <MenuItem value="CLOSE">CLOSE</MenuItem>
                                       </TextField>
                                       <TextField
                                          size="small"
                                          select
                                          onChange={(e) => handleValueChange(e, switchObj.id)}
                                          value={switchObj.isInt}
                                          name="isInt"
                                          label={MIMConfig.isInt.label}
                                       >
                                          <MenuItem value="3">Not Int</MenuItem>
                                          <MenuItem value="4">Int</MenuItem>
                                       </TextField>
                                    </Stack>
                                 </Accordion>
                              ))}
                           </>
                        )}
                     </Box>
                  )}
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
                     <Stack
                        spacing={1}
                        sx={{
                           padding: 1,
                           flexWrap: "wrap",
                           justifyContent: "center",
                           "& .MuiTextField-root": { width: "13rem" },
                        }}
                        direction={"row"}
                        useFlexGap
                     >
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
                        <Tooltip title={DDosConfig.threadsPerAttacker.desc} placement="left" arrow>
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
                     </Stack>
                  )}
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
