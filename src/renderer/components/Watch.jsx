import React from 'react';
import ReactDOM from 'react-dom';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Typography
} from '@mui/material';
import { CustomButton } from '../utils/CustomComponents';

function Watch({ open, close, watchData }) {
  if (!open) {
    return null;
  }

  return ReactDOM.createPortal(
    <Dialog hideBackdrop={true} open={open} maxWidth="md" fullWidth>
      <DialogTitle>Watching</DialogTitle>
      <DialogContent>
        {watchData &&
          Object.entries(watchData).map(([id, props], index) => (
            <FormGroup key={index}>
              <Typography variant="h6" gutterBottom>
                {id}
              </Typography>
              {props.map((prop, index) => (
                <>
                  <Typography key={index} variant="paragraph" gutterBottom>
                    {prop}
                  </Typography>
                </>
              ))}
            </FormGroup>
          ))}
      </DialogContent>
      <DialogActions>
        <CustomButton onClick={() => close()}>Close</CustomButton>
      </DialogActions>
    </Dialog>,
    document.getElementById('portal')
  );
}

export default Watch;
