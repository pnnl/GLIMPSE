import { styled } from '@mui/system';
import { Button, Fab, FormControlLabel, Switch } from '@mui/material';

export const CustomButton = styled(Button)({
  color: '#333333',
  ':hover': { backgroundColor: '#333333', color: '#FFFFFF' }
});

export const CustomFab = styled(Fab)({
  color: '#FFF',
  border: '1px solid grey',
  backgroundColor: '#333',
  ':hover': { backgroundColor: '#45AB48' }
});

export const CustomSwitch = styled(Switch)({
  '& .MuiSwitch-switchBase': {
    '&.Mui-checked': {
      color: '#45AB48',
      '& + .MuiSwitch-track': {
        backgroundColor: '#45AB48'
      }
    }
  }
});

export const CustomFormControlLabel = styled(FormControlLabel)({
  width: '100%',
  margin: '0',
  padding: '0 1rem',
  justifyContent: 'space-between'
});
