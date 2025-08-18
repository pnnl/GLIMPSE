import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
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
   FormControlLabel,
   Checkbox
} from '@mui/material';

import { ExpandMore, HelpOutline } from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';
import { CustomButton, CustomFormControlLabel, CustomSwitch } from '../utils/CustomComponents';

const packetSizeOptions = [500, 1280, 1500];
const topologyNames = ['mesh', 'ring'];
const rates = ['100Kbps', '500Kbps', '10Mbps', '80Mbps', '100Mbps', '500Mbps', '1Gbps', '10Gbps'];
const nodeTypes = ['Microgrid', 'Communication Node', 'Control Center'];

const switchWatchProporties = {
   status: true,
   current_out_A: true,
   current_out_B: true,
   current_out_C: true,
   power_out_A: true,
   power_out_B: true,
   power_out_C: true,
   phase_A_state: true,
   phase_B_state: true,
   phase_C_state: true
};

const inverterWatchProperties = {
   'VA_Out.real': true,
   'VA_Out.imag': true,
   V_In: true,
   VA_Out: true, // voltage
   Pref: true,
   Qref: true
};

// const genoratorWatchProperties = {
//    rotor_speed: true,
//    rotor_angle: true,
//    flux1d: true,
//    flux2q: true,
//    EpRotated: true,
//    VintRotated: true,
//    Eint_A: true,
//    Eint_B: true,
//    Eint_C: true,
//    power_out_A: true, // Voltage: power_out_A-C
//    power_out_B: true,
//    power_out_C: true,
//    GFA_status: true, // Frequency
//    measured_frequency: true, // Frequency
//    Irotated: true,
//    'pwr_electric.real': true,
//    'pwr_electric.imag': true,
//    pwr_mech: true,
//    torque_mech: true,
//    torque_elec: true,
//    Pref: true,
//    Qref: true
// };

const genoratorWatchProperties = {
   power_out_A: true, // Voltage: power_out_A-C
   power_out_B: true,
   power_out_C: true,
   measured_frequency: false, // Frequency
   Pref: true,
   Qref: true
};

/**
 * The NATIG Scenerio Configuration Modal
 * @param {Object} props - The props object
 * @param {bool} props.open - open state of the modal
 * @param {function} props.close - close function of the modal
 * @param {number} props.modelNumber - model number of the uploaded model
 * @param {function} props.applyOverlay - A useRef function to apply a overlay to the graph
 * @param {React.useRef} props.graphData - A useRef function to get the graph data object
 * @returns {JSX.Element} - The NATIG configuration modal
 */
const NatigConfigModal = ({
   open,
   close,
   modelNumber,
   applyOverlay,
   graphData,
   setWatchData,
   handleFileUpload
}) => {
   const [expanded, setExpanded] = useState(false);
   const [topology, setTopology] = useState({ name: '' });
   const [modelfiles, setModelfiles] = useState([]);
   const [selectedModelSet, setSelectedModelSet] = useState(null);
   const [modelLoaded, setModelLoaded] = useState(false);
   const [watchList, setWatchList] = useState({});
   React.useEffect(() => {
      window.glimpseAPI.getDefaultModelFiles().then(setModelfiles);
   }, []);

   const [generalConfig, setGeneralConfig] = useState({
      SimTime: {
         label: 'Simulation Time',
         desc: 'Controls how long the simulation is going to run in seconds.',
         value: 0
      },
      PollReqFreq: {
         label: 'Frequency',
         desc: 'How long do you want to wait between poll request in milliseconds.',
         value: 0
      },
      UseDynTop: {
         label: 'Custom Topology',
         desc: 'Do you want to use your own topology',
         value: false
      },
      MonitorPer: {
         label: 'Generate PCAP',
         desc: 'Do you want to generate PCAP file for traffic information',
         value: false
      },
      StaticSeed: {
         label: 'Use Seed',
         desc: 'Use a random seed or check to input your own',
         value: false
      },
      RandomSeed: {
         label: 'Seed',
         desc: 'input a seed',
         value: 0
      }
   });

   const [DDosConfig, setDDosConfig] = useState({
      Active: {
         label: 'Enable DDoS Attack',
         desc: 'Controls whether or not the DDoS attack will be active for the simulation',
         value: false
      },
      threadsPerAttacker: {
         label: 'Number of Attackers',
         desc: 'Control the number of attackers',
         value: 2
      },
      Start: {
         label: 'Start',
         desc: 'Number of seconds after the start of the simulation when the attack starts',
         value: 2
      },
      End: {
         label: 'End',
         desc: 'Number of seconds after the start of the simulation when the attack stops',
         value: 4
      },
      PacketSize: {
         label: 'Packet Size',
         desc: 'Controls the maximum transmissible unit the attackers link is set to',
         value: 1500
      },
      Rate: {
         label: 'Rate',
         desc: 'bytes sent per second by the attacker',
         value: '80Mbps'
      },
      NodeType: {
         label: 'DDoS Entry Point',
         desc: 'The type of node that the DDoS will be connected to',
         value: 'Microgrid'
      },
      endPoint: {
         label: 'DDoS End Point',
         desc: "The type of node that will be targeted by the bot's application",
         value: 'Communication Node'
      }
   });

   const [MIMConfig, setMIMConfig] = useState({
      includeMIM: {
         label: 'Enable MIM Attack',
         desc: 'Controls whether or not the MIM attack will be active during the simulation',
         value: false
      },
      objectsToAttack: {
         label: 'Enter ID of nodes that are under attacked',
         desc: 'List the IDs as represented in gridlabd of the nodes that will be attacked',
         value: []
      },
      StartOfAttack: {
         label: 'Start',
         desc: 'Start of the Attack'
      },
      EndOfAttack: {
         label: 'End',
         desc: 'This list should contain when you want the attack to end'
      },
      AttackPoint: {
         label: 'Attack Point',
         desc: 'Where to attack',
         value: {
            switch: ['status']
         }
      },
      AttackValue: {
         label: 'Attack Value',
         desc: 'What value the attacker sets during the attack',
         value: {
            switch: ['TRIP']
         }
      },
      RealValue: {
         label: 'Real Value',
         desc: 'What value should the point be set to after the attack. NA means it will keep the same value as the one set during the attack',
         value: {
            switch: ['NA', 'CLOSE']
         }
      },
      isInt: {
         label: 'Attack Type',
         desc: 'Is the attack value an integer'
      }
   });

   const objects = useMemo(() => {
      if (!graphData.current) return null;

      const switches = graphData.current.edges.get({ filter: (e) => e.type === 'switch' });
      const inverters = graphData.current.nodes.get({
         filter: (n) => ['inverter', 'inverter_dyn'].includes(n.type)
      });
      const genorators = graphData.current.nodes.get({ filter: (n) => n.type === 'diesel_dg' });

      return [...switches, ...inverters, ...genorators];
   }, [graphData.current]);

   const handleGeneralConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setGeneralConfig({
         ...generalConfig,
         [name]: {
            ...generalConfig[name],
            value: type === 'checkbox' ? checked : value
         }
      });
   };

   const handleDDosConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setDDosConfig({
         ...DDosConfig,
         [name]: {
            ...DDosConfig[name],
            value: type === 'checkbox' ? checked : value
         }
      });
   };

   const handleValueChange = (e, objID) => {
      const { name, value } = e.target;
      let updatedObjs = null;

      if (name === 'attackPoint') {
         // If the attack point is selected, we need to set the attack value and real value accordingly
         updatedObjs = MIMConfig.objectsToAttack.value.map((obj) =>
            obj.id === objID ? { ...obj, [name]: value, realValue: obj.attributes[value] } : obj
         );
      } else {
         updatedObjs = MIMConfig.objectsToAttack.value.map((obj) =>
            obj.id === objID ? { ...obj, [name]: value } : obj
         );
      }

      // Update the state with the modified array
      setMIMConfig({
         ...MIMConfig,
         objectsToAttack: {
            ...MIMConfig.objectsToAttack,
            value: updatedObjs
         }
      });
   };

   const handleMIMConfig = (e) => {
      const { name, value, type, checked } = e.target;

      setMIMConfig({
         ...MIMConfig,
         [name]: {
            ...MIMConfig[name],
            value: type === 'checkbox' ? checked : value
         }
      });
   };

   /**
    * Checks for valid attack points must not have the following words in their name:
    * - out
    * - mode
    * - phase
    * - type
    * - parent
    * - name
    * - flag
    * @param {string} name - The name of the attack point
    * @returns {boolean} true if the attack point is valid, false otherwise
    */
   const isValidAttackPoint = (name) => {
      if (name.toLowerCase().includes('out')) return false;
      else if (name.toLowerCase().includes('mode')) return false;
      else if (name.toLowerCase().includes('phase')) return false;
      else if (name.toLowerCase().includes('type')) return false;
      else if (name.toLowerCase().includes('parent')) return false;
      else if (name.toLowerCase().includes('name')) return false;
      else if (name.toLowerCase().includes('flag')) return false;
      else return true;
   };

   const handleTopologySelect = async (e) => {
      const { value: topoName } = e.target;

      if (modelNumber) {
         const response = await fetch(`./topologies/feeder_${modelNumber}/${topoName}.json`);
         setTopology({ name: topoName, data: await response.json() });
      } else {
         setTopology({ name: topoName });
      }
   };

   /**
    * Get a list of selected switches for MIM attack from Autocomplete component
    * @param {array} selectedObjs an array of switch objects
    */
   const handleObjectSelect = (selectedObjs) => {
      const currentObjs = MIMConfig.objectsToAttack.value;

      if (currentObjs.length === 0) {
         setMIMConfig({
            ...MIMConfig,
            objectsToAttack: {
               ...MIMConfig.objectsToAttack,
               value: selectedObjs.map((obj) => ({
                  id: obj.id,
                  type: obj.type,
                  attributes: obj.attributes,
                  start: '',
                  end: '',
                  attackPoint: '',
                  attackValue: '',
                  realValue: '',
                  isInt: obj.type === 'switch' ? '3' : '4'
               }))
            }
         });
      } else if (selectedObjs.length > currentObjs.length) {
         const newSwitches = selectedObjs.filter(
            (selectedObj) => !currentObjs.find((currentObj) => selectedObj.id === currentObj.id)
         );

         setMIMConfig({
            ...MIMConfig,
            objectsToAttack: {
               ...MIMConfig.objectsToAttack,
               value: [
                  ...currentObjs,
                  ...newSwitches.map((obj) => ({
                     id: obj.id,
                     type: obj.type,
                     attributes: obj.attributes,
                     start: 0,
                     end: 0,
                     attackPoint: '',
                     attackValue: '',
                     realValue: '',
                     isInt: obj.type === 'switch' ? '3' : '4'
                  }))
               ]
            }
         });
      } else {
         const removedObjects = currentObjs.filter(
            (obj) => !selectedObjs.some((selectedObj) => selectedObj.id === obj.id)
         );

         setMIMConfig({
            ...MIMConfig,
            objectsToAttack: {
               ...MIMConfig.objectsToAttack,
               value: currentObjs.filter(
                  (obj) => !removedObjects.some((removedObj) => removedObj.id === obj.id)
               )
            }
         });
      }
   };

   // TODO: add type to the list of properties
   const handleWatchSelect = (itemsToWatch) => {
      // Helper function to determine properties for a given object
      const getPropertiesForObject = (obj) => {
         console.log('getting properties for objects');
         if (obj.type === 'switch') {
            return switchWatchProporties;
         }

         if (obj.type === 'inverter' || obj.type === 'inverter_dyn') {
            const attributeProperties = Object.keys(obj.attributes)
               .filter((k) => isValidAttackPoint(k))
               .reduce((acc, key) => ({ ...acc, [key]: true }), {});
            return { ...inverterWatchProperties, ...attributeProperties };
         }

         if (obj.type === 'diesel_dg') {
            const attributeProperties = Object.keys(obj.attributes)
               .filter((k) => isValidAttackPoint(k))
               .reduce((acc, key) => ({ ...acc, [key]: true }), {});
            return { ...genoratorWatchProperties, ...attributeProperties };
         }
         return null;
      };
      if (Object.keys(watchList).length === 0) {
         // Initialize with first item
         const obj = itemsToWatch[0]; //to fix "obj is not defined" error. However, line 444 maybe not be accessing the same obj as the one above that has the actual type data?
         const properties = getPropertiesForObject(obj);
         /**
          * {
          * "ObjectID": {
          *    "type": "inverter",
          *    "props": [...properties]
          *   }
          * }
          */
         const setPropTypes = {
            type: obj.type,
            props: properties
         };
         console.log('properties = ' + JSON.stringify(properties));
         console.log('type = ' + obj.type);
         console.log('setPropTypes object: ' + JSON.stringify(setPropTypes));
         setWatchList({ [obj.id]: setPropTypes }); //'obj.id'?
      } else if (itemsToWatch.length > Object.keys(watchList).length) {
         // Add new item
         const newObj = itemsToWatch[itemsToWatch.length - 1];
         const properties = getPropertiesForObject(newObj);
         const setPropTypes = {
            type: newObj.type,
            props: properties
         };
         setWatchList((prevWatchList) => ({
            ...prevWatchList,
            [newObj.id]: setPropTypes
         }));
      } else {
         // Remove items (filter existing watchList)
         const itemIds = itemsToWatch.map((item) => (typeof item === 'string' ? item : item.id));
         const newWatchList = Object.keys(watchList)
            .filter((key) => itemIds.includes(key))
            .reduce(
               (acc, key) => ({
                  ...acc,
                  [key]: watchList[key]
               }),
               {}
            );

         setWatchList(newWatchList);
      }
   };

   const getSendObj = (formConfigObj) => {
      return Object.entries(formConfigObj).reduce(
         (o, [key, val]) => ({ ...o, [key]: val.value }),
         {}
      );
   };

   const getWatchObjs = () => {
      const watchObj = Object.entries(watchList).reduce((o, [id, value]) => {
         const { type, props } = value;
         const selectedProps = Object.keys(props).filter((prop) => props[prop]);

         /**
          * {
          *    id: {
          *       "type": props.type,
          *       "props": selectedProps
          *    }
          * }
          */

         return {
            ...o,
            [id]: {
               type: type,
               props: selectedProps
            }
         };
      }, {});

      return watchObj;
   };

   const getMIMSendObj = () => {
      if (!MIMConfig.includeMIM.value) {
         return {
            includeMIM: MIMConfig.includeMIM.value
         };
      }

      const attackObjects = MIMConfig.objectsToAttack.value;

      const sendSwitchesList = attackObjects.map((obj) => obj.id).join(',');
      const sendStartTimes = attackObjects.map((obj) => obj.start).join(',');
      const sendEndTimes = attackObjects.map((obj) => obj.end).join(',');
      const sendAttackPoints = attackObjects.map((obj) => obj.attackPoint).join(',');
      const sendAttackValues = attackObjects.map((obj) => obj.attackValue).join(',');
      const sendRealValues = attackObjects.map((obj) => obj.realValue).join(',');
      const sendAttckScenario = attackObjects.map((obj) => obj.isInt).join(',');

      return {
         includeMIM: MIMConfig.includeMIM.value,
         StartOfAttack: sendStartTimes,
         EndOfAttack: sendEndTimes,
         AttackPoint: sendAttackPoints,
         AttackValue: sendAttackValues,
         RealValue: sendRealValues,
         attackType: sendAttckScenario,
         objectsToAttack: sendSwitchesList
      };
   };

   const send = () => {
      if ('data' in topology) {
         if (topology.data.Node.every((node) => typeof node.name === 'number')) {
            topology.data.Node.map((commNode) => {
               commNode.name = `comm${commNode.name + 1}`;
               commNode.connections = commNode.connections.map((id) => `comm${id + 1}`);
            });
         }

         const watchData = getWatchObjs();

         const natigGeneralConfig = {
            modelNumber: modelNumber,
            ...getSendObj(generalConfig),
            ...getSendObj(DDosConfig),
            ...getMIMSendObj(),
            topology: { ...topology },
            watchList: Object.entries(watchData).reduce((acc, [id, values]) => {
               acc[id] = values.props;
               return acc;
            }, {})
         };

         console.log(natigGeneralConfig);
         console.log('Watch Data:', watchData);
         setWatchData(watchData);

         window.glimpseAPI.sendNatigConfig(natigGeneralConfig);

         close();
      } else {
         alert('Upload a feeder model ex: ieee3000_Feeder3.glm');
      }
   };

   const handleExpand = (panelName) => (e, isExpanded) => {
      setExpanded(isExpanded ? panelName : false);
   };

   const applyTopolgy = async () => {
      applyOverlay.current(undefined, modelNumber, topology.data);
   };

   const applyModel = async () => {
      await handleFileUpload(modelfiles);
      setModelLoaded(true);
   };

   const handleWatchProp = (e, id) => {
      const { name, checked } = e.target;

      setWatchList((prevWatchList) => ({
         ...prevWatchList,
         [id]: {
            ...prevWatchList[id],
            props: {
               ...prevWatchList[id].props,
               [name]: checked
            }
         }
      }));
   };

   const handleModelSelect = async (e) => {
      const set = e.target.value;
      if (set === '__select_files__') {
         const filePaths = await window.glimpseAPI.getFilePaths();
         if (filePaths && filePaths.length > 0) {
            setModelfiles(filePaths);
            setSelectedModelSet(null);
         }
      } else {
         setSelectedModelSet(set);
         const filePaths = await window.glimpseAPI.getFilePathsSet(set);
         if (filePaths && filePaths.length > 0) {
            setModelfiles(filePaths);
         }
      }
   };

   return ReactDOM.createPortal(
      <Dialog fullWidth open={open}>
         <DialogTitle
            sx={{
               color: '#ffffff',
               backgroundColor: 'rgba(51,51,51, 0.8)',
               fontWeight: 'bold',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'space-between'
            }}
         >
            Model and Scenario Setup
            <Tooltip
               title="Use this form to configure cyber-physical system and the attack scenario for simulation"
               placement="right"
               arrow
            >
               <IconButton sx={{ color: '#ffffff' }}>
                  <HelpOutline />
               </IconButton>
            </Tooltip>
         </DialogTitle>
         <DialogContent dividers>
            <Stack direction={'row'} spacing={1}>
               <Tooltip title={'Select or upload model files'} placement="left" arrow>
                  <FormControl fullWidth>
                     <InputLabel id="model-set-label">Model Set</InputLabel>
                     <Select
                        labelId="model-set-label"
                        value={selectedModelSet || ''}
                        label="Model Set"
                        onChange={handleModelSelect}
                     >
                        <MenuItem value="__select_files__">
                           <em>Select Model Files</em>
                        </MenuItem>
                        <MenuItem value="123">123</MenuItem>
                        <MenuItem value="13">13</MenuItem>
                        <MenuItem value="3000">3000</MenuItem>
                        <MenuItem value="8500">8500</MenuItem>
                        <MenuItem value="9500">9500</MenuItem>
                     </Select>
                  </FormControl>
               </Tooltip>
            </Stack>

            <Divider sx={{ m: '0.5rem 0' }} />

            <Stack direction={'row'} spacing={1} sx={{ mt: 2 }}>
               <Tooltip title={'Select a default model set'} placement="left" arrow>
                  <FormControl fullWidth>
                     {modelfiles && modelfiles.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                           {modelfiles.map((file, idx) => (
                              <div key={idx} style={{ fontSize: '0.85rem' }}>
                                 {typeof file === 'string' ? file : file.name}
                              </div>
                           ))}
                        </Box>
                     )}
                     <Tooltip title={'Load model'} placement="right" arrow>
                        <CustomButton onClick={applyModel}>Load</CustomButton>
                     </Tooltip>
                  </FormControl>
               </Tooltip>
            </Stack>

            <Divider sx={{ m: '0.5rem 0' }} />

            <Stack direction={'row'} spacing={1}>
               <Tooltip title={'Choose a topology for uploaded model'} placement="left" arrow>
                  <FormControl fullWidth>
                     <InputLabel>Topology</InputLabel>
                     <Select
                        label={'Topology'}
                        name={'topology'}
                        value={topology.name}
                        onChange={handleTopologySelect}
                        disabled={!modelLoaded}
                     >
                        {topologyNames.map((name, index) => (
                           <MenuItem key={index} value={name}>
                              {name}
                           </MenuItem>
                        ))}
                     </Select>
                  </FormControl>
               </Tooltip>
               <Tooltip title={'Apply topology to visualization'} placement="right" arrow>
                  <CustomButton onClick={applyTopolgy} disabled={!modelLoaded}>
                     Apply
                  </CustomButton>
               </Tooltip>
            </Stack>

            <Divider sx={{ m: '0.5rem 0' }} />

            <Accordion
               expanded={expanded === 'General Settings'}
               onChange={handleExpand('General Settings')}
               disabled={!modelLoaded}
               disableGutters
            >
               <AccordionSummary expandIcon={<ExpandMore />}>Simulation Settings</AccordionSummary>
               <Stack sx={{ margin: '1rem' }} direction={'column'} spacing={1}>
                  <Tooltip title={generalConfig.SimTime.desc} placement="left" arrow>
                     <TextField
                        variant="outlined"
                        value={generalConfig.SimTime.value}
                        name="SimTime"
                        label={generalConfig.SimTime.label}
                        onChange={handleGeneralConfig}
                        slotProps={{
                           input: {
                              endAdornment: <InputAdornment position="end">Seconds</InputAdornment>
                           }
                        }}
                     />
                  </Tooltip>
                  <Tooltip title={generalConfig.PollReqFreq.desc} placement="left" arrow>
                     <TextField
                        variant="outlined"
                        value={generalConfig.PollReqFreq.value}
                        name="PollReqFreq"
                        label={generalConfig.PollReqFreq.label}
                        onChange={handleGeneralConfig}
                        slotProps={{
                           input: {
                              endAdornment: <InputAdornment position="end">ms</InputAdornment>
                           }
                        }}
                     />
                  </Tooltip>
                  <Tooltip title={generalConfig.UseDynTop.desc} placement="left" arrow>
                     <CustomFormControlLabel
                        control={
                           <CustomSwitch
                              name={'UseDynTop'}
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
                              name={'MonitorPer'}
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
                              name={'StaticSeed'}
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
                           label={generalConfig.RandomSeed.label}
                           onChange={handleGeneralConfig}
                        />
                     </Tooltip>
                  )}
               </Stack>
            </Accordion>

            <Divider sx={{ m: '0.5rem 0' }} />

            <Accordion
               expanded={expanded === 'Attack Scenerio Settings'}
               onChange={handleExpand('Attack Scenerio Settings')}
               disabled={!modelLoaded}
               disableGutters
            >
               <AccordionSummary expandIcon={<ExpandMore />}>
                  Attack Scenario Settings
               </AccordionSummary>
               <Tooltip title={MIMConfig.includeMIM.desc} placement="left" arrow>
                  <CustomFormControlLabel
                     control={
                        <CustomSwitch
                           name={'includeMIM'}
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
                        display: 'flex',
                        flexDirection: 'column'
                     }}
                  >
                     <Tooltip title={MIMConfig.objectsToAttack.desc} placement="left" arrow>
                        <Autocomplete
                           sx={{ padding: '0 1.5rem', margin: '0 0 1rem 0' }}
                           size="small"
                           fullWidth
                           multiple
                           limitTags={3}
                           options={objects}
                           getOptionLabel={(obj) => obj.id}
                           value={MIMConfig.objectsToAttack.value.map((obj) => obj)}
                           onChange={(_, selectedObject) => handleObjectSelect(selectedObject)}
                           renderInput={(params) => (
                              <TextField
                                 {...params}
                                 size="small"
                                 label="Select Objects To Attack"
                              />
                           )}
                        />
                     </Tooltip>
                     {MIMConfig.objectsToAttack.value.length > 0 && (
                        <>
                           {MIMConfig.objectsToAttack.value.map((obj, index) => (
                              <Accordion
                                 slotProps={{ transition: { unmountOnExit: true } }}
                                 elevation={1}
                                 square
                                 disableGutters
                                 key={index}
                              >
                                 <AccordionSummary expandIcon={<ExpandMore />}>
                                    {obj.id}
                                 </AccordionSummary>
                                 <Stack
                                    spacing={1}
                                    sx={{
                                       padding: 1,
                                       flexWrap: 'wrap',
                                       justifyContent: 'center',
                                       '& .MuiTextField-root': { width: '13rem' }
                                    }}
                                    direction={'row'}
                                    useFlexGap
                                 >
                                    <TextField
                                       size="small"
                                       onChange={(e) => handleValueChange(e, obj.id)}
                                       value={obj.start}
                                       name="start"
                                       label={MIMConfig.StartOfAttack.label}
                                    />
                                    <TextField
                                       size="small"
                                       onChange={(e) => handleValueChange(e, obj.id)}
                                       value={obj.end}
                                       name="end"
                                       label={MIMConfig.EndOfAttack.label}
                                    />
                                    <TextField
                                       size="small"
                                       select
                                       onChange={(e) => handleValueChange(e, obj.id)}
                                       value={obj.attackPoint}
                                       name="attackPoint"
                                       label={MIMConfig.AttackPoint.label}
                                    >
                                       {obj.type === 'inverter' || obj.type === 'diesel_dg'
                                          ? Object.keys(obj.attributes)
                                               .filter((key) => isValidAttackPoint(key))
                                               .map((key, i) => (
                                                  <MenuItem key={i} value={key}>
                                                     {key}
                                                  </MenuItem>
                                               ))
                                          : MIMConfig.AttackPoint.value[obj.type].map(
                                               (point, i) => (
                                                  <MenuItem key={i} value={point}>
                                                     {point}
                                                  </MenuItem>
                                               )
                                            )}
                                    </TextField>
                                    {obj.type === 'switch' ? (
                                       <TextField
                                          size="small"
                                          select
                                          name="attackValue"
                                          value={obj.attackValue}
                                          label={MIMConfig.AttackValue.label}
                                          onChange={(e) => handleValueChange(e, obj.id)}
                                       >
                                          {MIMConfig.AttackValue.value.switch.map((value, i) => (
                                             <MenuItem key={i} value={value}>
                                                {value}
                                             </MenuItem>
                                          ))}
                                       </TextField>
                                    ) : (
                                       <TextField
                                          size="small"
                                          type={!isNaN(Number(obj.realValue)) ? 'number' : 'text'}
                                          onChange={(e) => handleValueChange(e, obj.id)}
                                          value={obj.attackValue}
                                          name="attackValue"
                                          label={MIMConfig.AttackValue.label}
                                       />
                                    )}
                                    <TextField
                                       size="small"
                                       onChange={(e) => handleValueChange(e, obj.id)}
                                       value={obj.realValue !== '' ? obj.realValue : ''}
                                       name="realValue"
                                       label={MIMConfig.RealValue.label}
                                    />
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
                           name={'Active'}
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
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        '& .MuiTextField-root': { width: '13rem' }
                     }}
                     direction={'row'}
                     useFlexGap
                  >
                     <Tooltip title={DDosConfig.Start.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={DDosConfig.Start.value}
                           name="Start"
                           label={DDosConfig.Start.label}
                           onChange={handleDDosConfig}
                        />
                     </Tooltip>
                     <Tooltip title={DDosConfig.End.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={DDosConfig.End.value}
                           name="End"
                           label={DDosConfig.End.label}
                           onChange={handleDDosConfig}
                        />
                     </Tooltip>
                     <Tooltip title={DDosConfig.threadsPerAttacker.desc} placement="left" arrow>
                        <TextField
                           variant="outlined"
                           value={DDosConfig.threadsPerAttacker.value}
                           name="threadsPerAttacker"
                           label={DDosConfig.threadsPerAttacker.label}
                           onChange={handleDDosConfig}
                        />
                     </Tooltip>
                     <Tooltip title={DDosConfig.PacketSize.desc} placement="left" arrow>
                        <TextField
                           select
                           label={DDosConfig.PacketSize.label}
                           name={'PacketSize'}
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
                           name={'Rate'}
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
                           name={'NodeType'}
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
                           name={'endPoint'}
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

            {/* <Divider sx={{ m: '0.5rem 0' }} /> */}

            <Accordion
               expanded={expanded === 'Watch'}
               onChange={handleExpand('Watch')}
               disabled={!modelLoaded}
               disableGutters
            >
               <AccordionSummary expandIcon={<ExpandMore />}>Watch</AccordionSummary>
               <Autocomplete
                  sx={{ padding: '0 1.5rem', m: '0 0 1rem 0' }}
                  size="small"
                  fullWidth
                  multiple
                  limitTags={3}
                  options={objects}
                  getOptionLabel={(obj) => (typeof obj === 'string' ? obj : obj.id)}
                  value={Object.keys(watchList)}
                  onChange={(_, obj) => handleWatchSelect(obj)}
                  renderInput={(params) => (
                     <TextField {...params} size="small" label="Select Objects to Watch" />
                  )}
               />
               {Object.keys(watchList).length > 0 && (
                  <>
                     {Object.entries(watchList).map(([id, objOptions], index) => (
                        <Accordion key={index} disableGutters elevation={1}>
                           <AccordionSummary expandIcon={<ExpandMore />}>{id}</AccordionSummary>
                           <FormControl
                              sx={{
                                 padding: '0 2rem',
                                 width: '100%',
                                 justifyContent: 'space-between',
                                 flexDirection: 'row',
                                 flexWrap: 'wrap'
                              }}
                              component={'fieldset'}
                              variant="standards"
                           >
                              {/*
                                 {
                                  "a": {p1: true, p2:true},
                                  "b": {p3: true, p4:true}
                                 }
                                 Object.entries
                                            0                           1
                                 [["a", {p1: true, p2:true}], ["b", {p3: true, p4:true}]]
                                 Object.entries
                                 [[p1, true], [p2, true]]
                               */}
                              {/* return all the properties except "type" */}
                              {/**            "props".props */}
                              {Object.entries(objOptions.props).map(([prop, checked], index) => (
                                 <FormControlLabel
                                    sx={{
                                       width: '9rem',
                                       whiteSpace: 'nowrap',
                                       overflow: 'hidden',
                                       textOverflow: 'ellipsis'
                                    }}
                                    title={prop}
                                    key={index}
                                    label={prop}
                                    control={
                                       <Checkbox
                                          onChange={(e) => handleWatchProp(e, id)}
                                          checked={checked}
                                          size="small"
                                          name={prop}
                                       />
                                    }
                                 />
                              ))}
                           </FormControl>
                        </Accordion>
                     ))}
                  </>
               )}
            </Accordion>
         </DialogContent>
         <DialogActions>
            <CustomButton onClick={send} disabled={!modelLoaded}>
               Send
            </CustomButton>
            <CustomButton onClick={close}>close</CustomButton>
         </DialogActions>
      </Dialog>,
      document.getElementById('portal')
   );
};

export default NatigConfigModal;
