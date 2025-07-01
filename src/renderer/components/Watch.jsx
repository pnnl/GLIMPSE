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

// think of watchData as a map of ids to an array of property names
const Watch = ({ watchData }) => {
  const [watchUpdates, setWatchUpdates] = useState(null);

  if (watchUpdates) {
    // configure visualization here
  }

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

    //selecting the two numbers, ignoring +s and -s (Only the first number gets used here).
    const regex = /[^+-]?\d*\.?\d+/g;
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
          timestamp: csvData[id][0],
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
            {Object.entries(watchUpdates).map(([id, props], index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography gutterBottom variant="h5" key={index}>
                    {id}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {Object.entries(props[props.length - 1]).map(([prop, value], index) => (
                    <Typography key={index} variant="body2">
                      {prop}: {value}
                    </Typography>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
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
