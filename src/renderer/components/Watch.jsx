import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Divider,
  Typography
} from '@mui/material';
import { CustomButton } from '../utils/CustomComponents';

const Watch = ({ open, close, watchData }) => {
  const [watchUpdates, setWatchUpdates] = React.useState(null);
  console.log(watchUpdates);

  useEffect(() => {
    const removeListenerArr = [];

    removeListenerArr.push(
      window.glimpseAPI.onUpdateWatchItem((watchObj) => {
        if (!watchData) return null;
        let csvData = null;

        if (typeof watchObj === 'string') csvData = JSON.parse(watchObj)['csv_data'];
        else csvData = watchObj['csv_data'];

        console.log(csvData);
        for (let props of Object.values(csvData)) {
          console.log(props.length);
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
      removeListenerArr.forEach((removeListener) => removeListener());
    };
  });

  return ReactDOM.createPortal(
    <Dialog sx={{ minHeight: '20rem' }} hideBackdrop={true} open={open} maxWidth="md" fullWidth>
      <DialogTitle>Watching</DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <CustomButton onClick={() => close()}>Close</CustomButton>
      </DialogActions>
    </Dialog>,
    document.getElementById('portal')
  );
};

export default Watch;
