import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
   Stack,
   Divider,
   Typography,
   Box,
   Accordion,
   AccordionSummary,
   AccordionDetails
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import {
   Chart as ChartJS,
   CategoryScale,
   LinearScale,
   PointElement,
   LineElement,
   Title,
   Tooltip,
   Legend,
   BarElement,
   BarController
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

const optionsCurrentOut = {
   options: {
      animation: false,
      plugins: {
         tooltip: {
            enabled: true
         }
      }
   },
   responsive: true,
   plugins: {
      legend: {
         position: 'right'
      },
      title: {
         display: true,
         text: 'Current Out A, B, C'
      }
   }
};

const optionsPowerOut = {
   options: {
      animation: false,
      plugins: {
         tooltip: {
            enabled: true
         }
      }
   },
   responsive: true,
   plugins: {
      legend: {
         position: 'right'
      },
      title: {
         display: true,
         text: 'Power Out A, B, C'
      }
   }
};

ChartJS.register(
   CategoryScale,
   LinearScale,
   PointElement,
   LineElement,
   Title,
   Tooltip,
   Legend,
   BarElement,
   BarController
);

// inverters
// Chart #1
// VA_out

// generators
// Chart #1
// measured_frequency
// Chart #2
// power_out_A
// power_out_B
// power_out_C

//Switches
// Chart #1
// current_out_A-C
// Chart #2
// power_out_A-C

// think of watchData as a map of ids to an array of property names
const Watch = ({ watchData }) => {
   const [watchUpdates, setWatchUpdates] = useState(null);

   const handleUpdateWatchItem = (watchObj) => {
      if (!watchData) return null;

      const csvData =
         typeof watchObj === 'string' ? JSON.parse(watchObj)['csv_data'] : watchObj['csv_data'];

      // for each array in the csvdata, check if it has at least 10 elements
      for (let props of Object.values(csvData)) {
         if (props.length < 10) {
            return null;
         }
      }

      //csvData from NATIG only contains the values
      console.log(csvData);

      //selecting the two numbers, ignoring +s and -s (Only the first number gets used here).
      const regex = /[^+-]?\d*\.?\d+/g;
      // add the power out property names here
      const dataUpdate = {};

      // for each id in watchData, create an object with the timestamp and the property values
      for (let [id, properties] of Object.entries(watchData)) {
         // {
         // "type": "inverter",
         // "props": [...props]
         //}

         //                     properties.props.reduce...
         let watchPropUpdates = properties.reduce((acc, propName, index) => {
            const value = csvData[id][index + 1]; // +1 to skip the timestamp
            const matches = value.match(regex);

            acc[propName] = !matches.length ? value : matches[0];
            return acc;
         }, {});

         dataUpdate[id] = [
            {
               timestamp: csvData[id][0].split(' ')[1], //only get the time without the date
               // type: properties.type,
               ...watchPropUpdates
            }
         ];
      }

      if (!watchUpdates) {
         setWatchUpdates(dataUpdate);
      } else {
         setWatchUpdates((prevUpdates) => {
            const newUpdates = { ...prevUpdates };

            for (const [id, props] of Object.entries(dataUpdate)) {
               newUpdates[id] = [...newUpdates[id], ...props];
            }

            return newUpdates;
         });
      }
   };

   useEffect(() => {
      const rmListner = window.glimpseAPI.onUpdateWatchItem(handleUpdateWatchItem);

      return () => {
         rmListner();
      };
   });

   const watchContent = (
      <Box sx={{ height: '100%', width: '100%' }}>
         <Stack spacing={1} divider={<Divider orientation="horizontal" flexItem />}>
            {watchUpdates ? (
               <>
                  {Object.entries(watchUpdates).map(([id, props], index) => {
                     const labels = props.map((prop) => prop.timestamp);
                     const currentOutData = {
                        labels,
                        datasets: [
                           {
                              label: 'current_out_A',
                              data: props.map((prop) => prop.current_out_A),
                              borderColor: 'rgba(255, 0,0,1)',
                              backgroundColor: 'rgba(255, 0,0,0.5)'
                           },
                           {
                              label: 'current_out_B',
                              data: props.map((prop) => prop.current_out_B),
                              borderColor: 'rgba(0, 255, 0, 1)',
                              backgroundColor: 'rgba(0, 255, 0, 0.5)',
                              stepped: true
                           },
                           {
                              label: 'current_out_C',
                              data: props.map((prop) => prop.current_out_C),
                              borderColor: 'rgba(0, 255, 255, 1)',
                              backgroundColor: 'rgba(0, 255, 255, 0.5)'
                           }
                        ]
                     };

                     const powerOutData = {
                        labels,
                        datasets: [
                           {
                              label: 'power_out_A',
                              data: props.map((prop) => prop.power_out_A),
                              borderColor: 'rgba(255, 0,0,1)',
                              backgroundColor: 'rgba(255, 0,0,0.5)'
                           },
                           {
                              label: 'power_out_B',
                              data: props.map((prop) => prop.power_out_B),
                              borderColor: 'rgba(0, 255, 0, 1)',
                              backgroundColor: 'rgba(0, 255, 0, 0.5)',
                              stepped: true
                           },
                           {
                              label: 'power_out_C',
                              data: props.map((prop) => prop.power_out_C),
                              borderColor: 'rgba(0, 255, 255, 1)',
                              backgroundColor: 'rgba(0, 255, 255, 0.5)'
                           }
                        ]
                     };

                     return (
                        <Accordion disableGutters square elevation={1} key={index}>
                           <AccordionSummary expandIcon={<ExpandMore />}>
                              <Typography gutterBottom variant="h5" key={index}>
                                 {id}
                              </Typography>
                           </AccordionSummary>
                           <AccordionDetails>
                              <Stack direction={'row'} spacing={1} useFlexGap>
                                 <Line options={optionsCurrentOut} data={currentOutData} />
                                 <Line options={optionsPowerOut} data={powerOutData} />
                              </Stack>
                           </AccordionDetails>
                        </Accordion>
                     );
                  })}
               </>
            ) : (
               <Typography variant="h5">Waiting for watch data...</Typography>
            )}
         </Stack>
      </Box>
   );

   const inPortal = window.location.pathname.includes('protal.html');

   return inPortal
      ? watchContent
      : ReactDOM.createPortal(watchContent, document.getElementById('portal'));
};

export default Watch;
