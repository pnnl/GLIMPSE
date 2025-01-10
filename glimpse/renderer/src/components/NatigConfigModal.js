import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
   Dialog,
   DialogActions,
   DialogContent,
   DialogTitle,
   InputAdornment,
   Stack,
   TextField,
   Tooltip,
} from "@mui/material";
import { CustomButton, CustomFormControlLabel, CustomSwitch } from "../utils/CustomComponents";
import { sendNatigConfig } from "../utils/webSocketClientUtils";

const NatigConfigModal = ({ onMount }) => {
   const [openForm, setOpenForm] = useState(false);
   const [configObj, setConfigObj] = useState({
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

   const handleChange = (e) => {
      const { name, value, type, checked } = e.target;

      setConfigObj({
         ...configObj,
         [name]: {
            ...configObj[name],
            value: type === "checkbox" ? checked : value,
         },
      });
   };

   const send = () => {
      const natigConfigObj = Object.entries(configObj).reduce(
         (o, [key, val]) => ({ ...o, [key]: val.value }),
         {}
      );

      console.log(natigConfigObj);

      sendNatigConfig(natigConfigObj);
   };

   useEffect(() => {
      onMount(setOpenForm);
   }, [onMount]);

   return ReactDOM.createPortal(
      <>
         <Dialog open={openForm}>
            <DialogTitle>NATIG Configuration</DialogTitle>
            <DialogContent dividers>
               <Stack direction={"column"} spacing={1}>
                  <Tooltip title={configObj.SimTime.desc} placement="left" arrow>
                     <TextField
                        variant="outlined"
                        value={configObj.SimTime.value}
                        name="SimTime"
                        label={configObj.SimTime.label}
                        onChange={handleChange}
                        type="number"
                        slotProps={{
                           input: {
                              endAdornment: <InputAdornment position="end">Seconds</InputAdornment>,
                           },
                        }}
                     />
                  </Tooltip>
                  <Tooltip title={configObj.PollReqFreq.desc} placement="left" arrow>
                     <TextField
                        variant="outlined"
                        value={configObj.PollReqFreq.value}
                        name="PollReqFreq"
                        type="number"
                        label={configObj.PollReqFreq.label}
                        onChange={handleChange}
                        slotProps={{
                           input: {
                              endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                           },
                        }}
                     />
                  </Tooltip>
                  <Tooltip title={configObj.UseDynTop.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        control={
                           <CustomSwitch
                              name={"UseDynTop"}
                              checked={configObj.UseDynTop.value}
                              value={configObj.UseDynTop.value}
                              size="medium"
                              onChange={handleChange}
                           />
                        }
                        label={configObj.UseDynTop.label}
                        labelPlacement="start"
                     />
                  </Tooltip>
                  <Tooltip title={configObj.MonitorPer.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        control={
                           <CustomSwitch
                              name={"MonitorPer"}
                              checked={configObj.MonitorPer.value}
                              value={configObj.MonitorPer.value}
                              size="medium"
                              onChange={handleChange}
                           />
                        }
                        label={configObj.MonitorPer.label}
                        labelPlacement="start"
                     />
                  </Tooltip>
                  <Tooltip title={configObj.StaticSeed.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        control={
                           <CustomSwitch
                              name={"StaticSeed"}
                              checked={configObj.StaticSeed.value}
                              value={configObj.StaticSeed.value}
                              size="medium"
                              onChange={handleChange}
                           />
                        }
                        label={configObj.StaticSeed.label}
                        labelPlacement="start"
                     />
                  </Tooltip>
                  {configObj.StaticSeed.value && (
                     <Tooltip title={configObj.RandomSeed.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={configObj.RandomSeed.value}
                           name="RandomSeed"
                           type="number"
                           label={configObj.RandomSeed.label}
                           onChange={handleChange}
                        />
                     </Tooltip>
                  )}
               </Stack>
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
