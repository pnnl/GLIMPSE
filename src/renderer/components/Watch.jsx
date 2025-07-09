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

const options = {
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
      text: 'Current Out A-C'
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

    console.log('watchObj', watchObj);

    //selecting the two numbers, ignoring +s and -s (Only the first number gets used here).
    const regex = /[^+-]?\d*\.?\d+/g;
    // add the power out property names here
    const validPropNames = ['current_out_A', 'current_out_B', 'current_out_C'];
    const dataUpdate = {};

    // for each id in watchData, create an object with the timestamp and the properties
    for (let [id, propNames] of Object.entries(watchData)) {
      // propnames is an array of property names
      let reducedPropertyNames = propNames.reduce((accumulator, propName, index) => {
        if (validPropNames.includes(propName)) {
          const value = csvData[id][index + 1]; // +1 to skip the timestamp
          accumulator[propName] = value.match(regex)[0];
        }
        return accumulator;
      }, {});

      dataUpdate[id] = [
        {
          timestamp: csvData[id][0].split(' ')[1],
          ...reducedPropertyNames
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
                    backgroundColor: 'rgba(255, 0,0,0.5)',
                    stepped: true
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
                    backgroundColor: 'rgba(0, 255, 255, 0.5)',
                    stepped: true
                  }
                ]
              };

              return (
                <Accordion key={index}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography gutterBottom variant="h5" key={index}>
                      {id}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Line options={options} data={currentOutData} />
                    {/* <Line options={options} data={powerOutData} /> */}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </>
        ) : (
          <Typography variant="body1">No watch data</Typography>
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
