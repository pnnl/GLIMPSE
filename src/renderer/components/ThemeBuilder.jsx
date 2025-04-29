import React, { useCallback, useState } from 'react';
import '../styles/ThemeBuilder.css';
import ReactDom from 'react-dom';
import Draggable from 'react-draggable';
import { CustomButton } from '../utils/CustomComponents';
import { MuiColorInput } from 'mui-color-input';
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  TextField,
  MenuItem,
  Stack,
  Divider,
  Typography
} from '@mui/material';

const ThemeBuilder = ({ close, open, visTheme, context, applyTheme }) => {
  if (!open) return null;

  const nodeTypes = Object.keys(visTheme.groups);
  const edgeTypes = Object.keys(visTheme.edgeOptions);

  const shapes = [
    'ellipse',
    'circle',
    'database',
    'box',
    'text',
    'diamond',
    'dot',
    'star',
    'triangle',
    'triangleDown',
    'hexagon',
    'square',
    'circularImage'
  ];

  const [themeBuilderFormFields, setThemeBuilderFormFields] = useState({
    newNodeStyles: {
      group: nodeTypes.indexOf(context.group),
      size: visTheme.groups[context.group].size,
      color: visTheme.groups[context.group].color,
      shape: shapes.indexOf(visTheme.groups[context.group].shape),
      ...('image' in visTheme.groups[context.group] && {
        image: visTheme.groups[context.group].image
      })
    },
    newEdgeStyles: {
      type: edgeTypes.indexOf(context.edgeType),
      width: visTheme.edgeOptions[context.edgeType].width,
      color: visTheme.edgeOptions[context.edgeType].color
    }
  });

  const onObjectTypeChange = useCallback((e) => {
    const { name, value } = e.target;

    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newNodeStyles: {
        [name]: value,
        ...visTheme.groups[nodeTypes[value]],
        shape: shapes.indexOf(visTheme.groups[nodeTypes[value]].shape),
        ...('image' in visTheme.groups[nodeTypes[value]] && {
          image: visTheme.groups[nodeTypes[value]].image
        })
      }
    }));
  }, []);

  const onEdgeTypeChange = useCallback((e) => {
    const { name, value } = e.target;

    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newEdgeStyles: {
        [name]: value,
        width: visTheme.edgeOptions[edgeTypes[value]].width,
        color: visTheme.edgeOptions[edgeTypes[value]].color
      }
    }));
  });

  const onNodeStyleChange = useCallback((e) => {
    const { name, value } = e.target;

    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newNodeStyles: {
        ...prevState.newNodeStyles,
        [name]: value
      }
    }));
  }, []);

  const onNodeColorChange = (newColor) => {
    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newNodeStyles: {
        ...prevState.newNodeStyles,
        color: newColor
      }
    }));
  };

  const onEdgeColorChange = (newColor) => {
    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newEdgeStyles: {
        ...prevState.newEdgeStyles,
        color: newColor
      }
    }));
  };

  const onEdgeStyleChange = useCallback((e) => {
    const { name, value } = e.target;

    setThemeBuilderFormFields((prevState) => ({
      ...prevState,
      newEdgeStyles: {
        ...prevState.newEdgeStyles,
        [name]: name === 'width' ? Number(value) : value
      }
    }));
  }, []);

  const setNodeImage = (e) => {
    if (e.target.files && e.target.files[0]) {
      setThemeBuilderFormFields((prevState) => ({
        ...prevState,
        newNodeStyles: {
          ...prevState.newNodeStyles,
          image: e.target.files[0].path
        }
      }));
    }
  };

  const apply = () => {
    const newStyles = {
      newNodeStyles: {
        ...themeBuilderFormFields.newNodeStyles,
        group: nodeTypes[themeBuilderFormFields.newNodeStyles.group],
        shape: shapes[themeBuilderFormFields.newNodeStyles.shape]
      },
      newEdgeStyles: {
        ...themeBuilderFormFields.newEdgeStyles,
        type: edgeTypes[themeBuilderFormFields.newEdgeStyles.type]
      }
    };

    applyTheme(newStyles);
  };

  const onSave = () => {
    apply();
    close();
  };

  return ReactDom.createPortal(
    <Draggable handle=".theme-builder-drag-handle" bounds=".vis-wrapper">
      <Card
        elevation={3}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: 375,
          height: 'auto',
          position: 'absolute',
          top: '40%',
          left: '50%',
          zIndex: 99
        }}
      >
        <CardHeader
          sx={{ ':hover': { cursor: 'move' } }}
          className="theme-builder-drag-handle"
          title="Theme Builder"
        />
        <Divider />
        <CardContent sx={{ m: 1, padding: 0 }}>
          <Typography gutterBottom variant="h6" component={'div'}>
            Node Theme
          </Typography>
          <Stack direction={'row'} spacing={1}>
            <TextField
              fullWidth
              select
              size="medium"
              name="group"
              label="Object Type"
              value={themeBuilderFormFields.newNodeStyles.group}
              onChange={onObjectTypeChange}
            >
              {nodeTypes.map((type, index) => (
                <MenuItem key={index} value={index}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <MuiColorInput
              fullWidth
              format="rgb"
              value={themeBuilderFormFields.newNodeStyles.color}
              onChange={onNodeColorChange}
            />
          </Stack>
          <Stack sx={{ mt: 1 }} direction={'row'} spacing={1}>
            <TextField
              fullWidth
              size="medium"
              name="size"
              label="Size"
              value={themeBuilderFormFields.newNodeStyles.size}
              type="number"
              onChange={onNodeStyleChange}
            />
            <TextField
              fullWidth
              size="medium"
              select
              name="shape"
              label="Shape"
              value={themeBuilderFormFields.newNodeStyles.shape}
              onChange={onNodeStyleChange}
            >
              {shapes.map((shape, index) => (
                <MenuItem key={index} value={index}>
                  {shape}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {shapes[themeBuilderFormFields.newNodeStyles.shape] === 'circularImage' && (
            <input accept=".svg,.png,.jpg" multiple={false} type="file" onChange={setNodeImage} />
          )}
          <Typography gutterBottom sx={{ mt: 1 }} variant="h6" component={'div'}>
            Edge Theme
          </Typography>
          <TextField
            select
            fullWidth
            name="type"
            value={themeBuilderFormFields.newEdgeStyles.type}
            label={'Edge Type'}
            onChange={onEdgeTypeChange}
          >
            {edgeTypes.map((type, index) => (
              <MenuItem key={index} value={index}>
                {type}
              </MenuItem>
            ))}
          </TextField>
          <Stack sx={{ mt: 1 }} direction={'row'} spacing={1}>
            <TextField
              fullWidth
              label="Width"
              type="number"
              name="width"
              value={themeBuilderFormFields.newEdgeStyles.width}
              onChange={onEdgeStyleChange}
            />
            <MuiColorInput
              fullWidth
              format="rgb"
              value={themeBuilderFormFields.newEdgeStyles.color}
              onChange={onEdgeColorChange}
            />
          </Stack>
        </CardContent>
        <Divider />
        <CardActions sx={{ mt: 'auto', justifyContent: 'flex-end' }}>
          <CustomButton variant="text" onClick={apply}>
            Apply
          </CustomButton>
          <CustomButton variant="text" onClick={onSave}>
            Save
          </CustomButton>
          <CustomButton variant="text" onClick={close}>
            Close
          </CustomButton>
        </CardActions>
      </Card>
    </Draggable>,
    document.getElementById('portal')
  );
};

export default ThemeBuilder;
