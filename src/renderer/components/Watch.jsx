import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Stack, Divider, Typography, Box } from '@mui/material';

const Watch = ({ watchData }) => {
  const [watchUpdates, setWatchUpdates] = useState(null);

  useEffect(() => {
    const removeListenerArr = [];

    removeListenerArr.push(
      window.glimpseAPI.onUpdateWatchItem((watchObj) => {
        console.log(watchObj);
        if (!watchData) return null;
        let csvData = null;

        if (typeof watchObj === 'string') csvData = JSON.parse(watchObj)['csv_data'];
        else csvData = watchObj['csv_data'];

        for (let props of Object.values(csvData)) {
          if (props.length < 10) {
            return null;
          }
        }

        // remove the first entry from each array in the csvData object since its a timestamp
        Object.keys(csvData).forEach((k) => csvData[k].shift());
        setWatchUpdates(csvData);
      })
    );

    return () => {
      removeListenerArr.forEach((rmListener) => rmListener());
    };
  });

  const watchContent = (
    <Box sx={{ height: '100%', width: '100%' }}>
      <Stack spacing={1} divider={<Divider orientation="horizontal" flexItem />}>
        {watchData ? (
          <>
            {Object.entries(watchData).map(([id, porps], index) => (
              <>
                <Typography gutterBottom variant="h5" key={index}>
                  {id}
                </Typography>
                {porps.map((prop, index) => (
                  <Typography key={index} variant="body2">
                    {prop}:{' '}
                    {watchUpdates && id in watchUpdates ? watchUpdates[id][index] : 'No data'}
                  </Typography>
                ))}
              </>
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
