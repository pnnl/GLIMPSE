import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  MenuItem,
  TextField,
  Divider,
  Typography,
  Autocomplete,
  Stack
} from '@mui/material';
import { CustomButton } from '../utils/CustomComponents';

const NewNodeForm = ({ onMount, nodes, addNode, nodeTypes, edgeTypes }) => {
  const [openForm, setOpenForm] = useState(false);
  const [formFields, setFormFields] = useState({
    nodeType: 0,
    nodeID: '',
    connectTo: '',
    edgeType: 0
  });

  const handleClose = () => {
    setOpenForm(false);
  };

  const createNewNode = () => {
    addNode(formFields);
    setOpenForm(false);
  };

  const handleChange = (e) => {
    e.preventDefault();

    const { name, value } = e.target;

    setFormFields((formFields) => ({
      ...formFields,
      [name]: value
    }));
  };

  useEffect(() => {
    onMount(setOpenForm);
  });

  return ReactDOM.createPortal(
    <>
      <Dialog fullWidth maxWidth="sm" scroll="paper" open={openForm} onClose={handleClose}>
        <DialogTitle id="new-node-title">New Node</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth>
            <TextField
              select
              name="nodeType"
              label="Node Type"
              variant="outlined"
              value={formFields.nodeType}
              onChange={handleChange}
            >
              {nodeTypes.map((type, index) => {
                return (
                  <MenuItem key={index} value={index}>
                    {type}
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              sx={{ mt: 2 }}
              name="nodeID"
              id="node-label"
              onChange={handleChange}
              label="ID"
              value={formFields.nodeID}
              variant="outlined"
            />
          </FormControl>
          <Divider sx={{ mt: 2 }} />
          <Typography variant="h6">Connections</Typography>
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <Autocomplete
                options={nodes()}
                onChange={(e, value) =>
                  setFormFields((formFields) => ({
                    ...formFields,
                    connectTo: value
                  }))
                }
                renderInput={(params) => (
                  <TextField value={formFields.connectTo} {...params} label="Connected To" />
                )}
              />
            </FormControl>
            <FormControl fullWidth>
              <TextField
                select
                value={formFields.edgeType}
                name="edgeType"
                label="Edge Type"
                variant="outlined"
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <CustomButton onClick={createNewNode}>Create Node</CustomButton>
          <CustomButton onClick={handleClose}>Cancel</CustomButton>
        </DialogActions>
      </Dialog>
    </>,
    document.getElementById('portal')
  );
};

export default NewNodeForm;
