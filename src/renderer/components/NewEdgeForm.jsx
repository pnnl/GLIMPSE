import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  FormControl,
  TextField,
  MenuItem,
  Divider,
  Stack,
  Autocomplete,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { CustomButton } from '../utils/CustomComponents';
import ReactDOM from 'react-dom';

export const NewEdgeForm = ({ onMount, nodes, edgeTypes, createEdge }) => {
  const [open, setOpen] = useState(false);
  const [newConnectionFields, setNewConnectionFields] = useState({
    edgeID: '',
    edgeType: 0,
    animate: false,
    from: '',
    to: ''
  });

  const createNewConnection = () => {
    const { edgeType, ...rest } = newConnectionFields;

    createEdge({ edgeType: edgeTypes[edgeType], ...rest });
    setOpen(false);
  };

  const handleChange = (e) => {
    e.preventDefault();

    const { name, value } = e.target;

    setNewConnectionFields((formFields) => ({
      ...formFields,
      [name]: value
    }));
  };

  const handleChecked = (e) => {
    const { name, checked } = e.target;

    setNewConnectionFields((previousFields) => ({
      ...previousFields,
      [name]: checked
    }));
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    onMount(setOpen);
  });

  return ReactDOM.createPortal(
    <Dialog maxWidth={false} open={open}>
      <DialogTitle>New Connection</DialogTitle>
      <DialogContent dividers>
        <FormControl fullWidth>
          <TextField
            sx={{ width: '28rem' }}
            name="edgeID"
            id="edge-label"
            onChange={handleChange}
            label="Edge ID"
            value={newConnectionFields.edgeID}
            variant="outlined"
          />
          <TextField
            sx={{ mt: 2, width: '28rem' }}
            select
            name="edgeType"
            label="Edge Type"
            variant="outlined"
            value={newConnectionFields.edgeType}
            onChange={handleChange}
          >
            {edgeTypes.map((type, index) => {
              return (
                <MenuItem key={index} value={index}>
                  {type}
                </MenuItem>
              );
            })}
          </TextField>
        </FormControl>
        <Divider sx={{ mt: 1 }} />
        <Stack sx={{ mt: 1, width: '28rem' }} direction="row" spacing={2}>
          <FormControl fullWidth>
            <Autocomplete
              options={nodes()}
              onChange={(e, value) =>
                setNewConnectionFields((formFields) => ({
                  ...formFields,
                  from: value
                }))
              }
              renderInput={(params) => (
                <TextField name="from" value={newConnectionFields.from} {...params} label="From" />
              )}
            />
          </FormControl>
          <FormControl fullWidth>
            <Autocomplete
              options={nodes()}
              onChange={(e, value) =>
                setNewConnectionFields((formFields) => ({
                  ...formFields,
                  to: value
                }))
              }
              renderInput={(params) => (
                <TextField name="to" value={newConnectionFields.to} {...params} label="To" />
              )}
            />
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                name="animate"
                onChange={handleChecked}
                checked={newConnectionFields.animate}
              />
            }
            label="Animate"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <CustomButton onClick={createNewConnection}>Create Connection</CustomButton>
        <CustomButton onClick={handleClose}>Cancel</CustomButton>
      </DialogActions>
    </Dialog>,
    document.getElementById('portal')
  );
};
