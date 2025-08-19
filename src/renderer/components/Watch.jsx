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

const optionsVAOut = {
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
         text: 'Voltage Out'
      }
   }
};

const optionsInverterEfficiency = {
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
         text: 'Inverter Efficiency'
      }
   }
};

const optionsRatedPower = {
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
         text: 'Rated Power'
      }
   }
};

const optionsGenPowerOut = {
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

const optionsPRefQRef = {
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
         text: 'Pref and Qref'
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

const Watch = ({ watchData }) => {
   const [watchUpdates, setWatchUpdates] = useState(null);
   console.log(watchData);
   const handleUpdateWatchItem = (watchObj) => {
      if (!watchData) return null;

      const csvData =
         typeof watchObj === 'string' ? JSON.parse(watchObj)['csv_data'] : watchObj['csv_data'];

      // for each array in the csvdata, check if it has at least 8 elements
      // TODO refactor to check the size of the data against what values we are watching
      for (let props of Object.values(csvData)) {
         if (props.length < 8) {
            return null;
         }
      }

      console.log(csvData);

      //selecting the two numbers, ignoring +s and -s (Only the first number gets used here).
      const regex = /[^+-]?\d*\.?\d+/g;
      const dataUpdate = {};

      for (let [id, info] of Object.entries(watchData)) {
         const { type, props: properties } = info;

         console.log(properties);

         try {
            let watchPropUpdates = properties.reduce((acc, propName, index) => {
               const value = csvData[id][index + 1]; // +1 to skip the timestamp
               const matches = value.match(regex);

               if (matches && matches.length > 0) {
                  acc[propName] = matches[0];
               } else {
                  acc[propName] = value;
               }

               return acc;
            }, {});

            dataUpdate[id] = {
               type: type,
               properties: [
                  {
                     timestamp: csvData[id][0].split(' ')[1], //only get the time without the date
                     type,
                     ...watchPropUpdates
                  }
               ]
            };
         } catch (error) {
            console.log(error);
         }
      }

      if (!watchUpdates) {
         setWatchUpdates(dataUpdate);
      } else {
         setWatchUpdates((prevUpdates) => {
            const newUpdates = { ...prevUpdates };

            for (const [id, props] of Object.entries(dataUpdate)) {
               newUpdates[id] = {
                  ...newUpdates[id],
                  properties: [...newUpdates[id].properties, ...props.properties]
               };
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
   console.log(watchUpdates);
   const watchContent = (
      <Box sx={{ height: '100%', width: '100%' }}>
         <Stack spacing={1} divider={<Divider orientation="horizontal" flexItem />}>
            {watchUpdates ? (
               <>
                  {Object.entries(watchUpdates).map(([id, dataProps], index) => {
                     const dataType = dataProps.type;
                     const labels = dataProps.properties.map((prop) => prop.timestamp);
                     let chartContent = null;
                     if (dataType === 'switch') {
                        const currentOutData = {
                           labels,
                           datasets: [
                              {
                                 label: 'current_out_A',
                                 data: dataProps.properties.map((prop) => prop.current_out_A),
                                 borderColor: 'rgba(255, 0,0,1)',
                                 backgroundColor: 'rgba(255, 0,0,0.5)'
                              },
                              {
                                 label: 'current_out_B',
                                 data: dataProps.properties.map((prop) => prop.current_out_B),
                                 borderColor: 'rgba(0, 255, 0, 1)',
                                 backgroundColor: 'rgba(0, 255, 0, 0.5)',
                                 stepped: true
                              },
                              {
                                 label: 'current_out_C',
                                 data: dataProps.properties.map((prop) => prop.current_out_C),
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
                                 data: dataProps.properties.map((prop) => prop.power_out_A),
                                 borderColor: 'rgba(255, 0,0,1)',
                                 backgroundColor: 'rgba(255, 0,0,0.5)'
                              },
                              {
                                 label: 'power_out_B',
                                 data: dataProps.properties.map((prop) => prop.power_out_B),
                                 borderColor: 'rgba(0, 255, 0, 1)',
                                 backgroundColor: 'rgba(0, 255, 0, 0.5)',
                                 stepped: true
                              },
                              {
                                 label: 'power_out_C',
                                 data: dataProps.properties.map((prop) => prop.power_out_C),
                                 borderColor: 'rgba(0, 255, 255, 1)',
                                 backgroundColor: 'rgba(0, 255, 255, 0.5)'
                              }
                           ]
                        };

                        chartContent = (
                           <Stack direction={'column'} spacing={1} sx={{ width: '100%' }}>
                              <Line options={optionsCurrentOut} data={currentOutData} />
                              <Line options={optionsPowerOut} data={powerOutData} />
                           </Stack>
                        );
                     } else if (dataType === 'inverter') {
                        const VAOutData = {
                           labels,
                           datasets: [
                              {
                                 label: 'VA_Out',
                                 data: dataProps.properties.map((prop) => prop.VA_Out),
                                 borderColor: 'rgba(219, 145, 35, 1)',
                                 backgroundColor: 'rgba(204, 159, 12, 0.5)',
                                 stepped: true
                              }
                           ]
                        };
                        const inverterEfficiencyData = {
                           labels,
                           datasets: [
                              {
                                 label: 'Inverter Efficiency',
                                 data: dataProps.properties.map((prop) => prop.inverter_efficiency),
                                 borderColor: 'rgba(18, 127, 216, 1)',
                                 backgroundColor: 'rgba(16, 114, 194, 0.5)',
                                 stepped: true
                              }
                           ]
                        };
                        const ratedPowerData = {
                           labels,
                           datasets: [
                              {
                                 label: 'Rated Power',
                                 data: dataProps.properties.map((prop) => prop.rated_power),
                                 borderColor: 'rgba(141, 20, 95, 1)',
                                 backgroundColor: 'rgba(155, 11, 107, 0.5)',
                                 stepped: true
                              }
                           ]
                        };
                        chartContent = (
                           <Stack direction={'column'} spacing={1} sx={{ width: '100%' }}>
                              <Line options={optionsVAOut} data={VAOutData} />
                              <Line
                                 options={optionsInverterEfficiency}
                                 data={inverterEfficiencyData}
                              />
                              <Line options={optionsRatedPower} data={ratedPowerData} />
                           </Stack>
                        );
                     } else if (dataType === 'diesel_dg') {
                        const genPowerOutData = {
                           labels,
                           datasets: [
                              {
                                 label: 'power_out_A',
                                 data: dataProps.properties.map((prop) => prop.power_out_A),
                                 borderColor: 'rgba(188, 43, 255, 1)',
                                 backgroundColor: 'rgba(180, 22, 185, 0.5)',
                                 stepped: true
                              },
                              {
                                 label: 'power_out_B',
                                 data: dataProps.properties.map((prop) => prop.power_out_B),
                                 borderColor: 'rgba(0, 162, 255, 1)',
                                 backgroundColor: 'rgba(6, 173, 214, 0.5)',
                                 stepped: true
                              },
                              {
                                 label: 'power_out_C',
                                 data: dataProps.properties.map((prop) => prop.power_out_C),
                                 borderColor: 'rgba(23, 219, 144, 1)',
                                 backgroundColor: 'rgba(36, 240, 162, 0.5)',
                                 stepped: true
                              }
                           ]
                        };

                        const pRefQRefData = {
                           labels,
                           datasets: [
                              {
                                 label: 'Pref',
                                 data: dataProps.properties.map((prop) => prop.Pref),
                                 borderColor: 'rgba(12, 235, 49, 1)',
                                 backgroundColor: 'rgba(54, 116, 12, 0.5)',
                                 stepped: true
                              },
                              {
                                 label: 'Qref',
                                 data: dataProps.properties.map((prop) => prop.Qref),
                                 borderColor: 'rgba(169, 52, 223, 1)',
                                 backgroundColor: 'rgba(122, 13, 165, 0.5)',
                                 stepped: true
                              }
                           ]
                        };

                        chartContent = (
                           <Stack direction={'column'} spacing={1} sx={{ width: '100%' }}>
                              <Line options={optionsGenPowerOut} data={genPowerOutData} />
                              <Line options={optionsPRefQRef} data={pRefQRefData} />
                           </Stack>
                        );
                     }
                     return (
                        <Accordion disableGutters square elevation={1} key={index}>
                           <AccordionSummary expandIcon={<ExpandMore />}>
                              <Typography gutterBottom variant="h5" key={index}>
                                 {id}
                              </Typography>
                           </AccordionSummary>
                           <AccordionDetails>
                              {chartContent ?? (
                                 <Typography variant="body1" color="text.secondary">
                                    No chart available for this type.
                                 </Typography>
                              )}
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
