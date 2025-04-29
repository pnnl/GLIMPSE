import React from 'react';
import ReactDOM from 'react-dom';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
  IconButton,
  FormGroup,
  FormControlLabel
} from '@mui/material';
import { CheckBox, HelpOutline } from '@mui/icons-material';
import { CustomButton } from '../utils/CustomComponents';

const WatchSelect = ({ id, proporties, show, close }) => {
  return ReactDOM.createPortal(
    <Dialog open={show}>
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
        Watch Proporties For {id}
        <Tooltip title="Select the the proporties you wish to watch" placement="right" arrow>
          <IconButton sx={{ color: '#ffffff' }}>
            <HelpOutline />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent dividers>
        <FormGroup>
          {proporties.map((prop, index) => (
            <>
              <FormControlLabel control={<CheckBox />} label={prop} key={index} />
            </>
          ))}
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <CustomButton onClick={close}>Cancel</CustomButton>
        <CustomButton>Watch</CustomButton>
      </DialogActions>
    </Dialog>,
    document.getElementById('portal')
  );
};

export default WatchSelect;
