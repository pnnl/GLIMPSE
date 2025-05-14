import React, { useEffect, useState } from 'react';
import {
  Button,
  ButtonGroup,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from '@mui/material';
import {
  RotateLeftSharp,
  RotateRightSharp,
  InsightsRounded,
  HideSource,
  Add
} from '@mui/icons-material';

const VisRibbon = ({
  rotateCW,
  rotateCCW,
  next,
  prev,
  legendContainerRef,
  networkContainerRef,
  layoutContainerRef,
  circularProgressRef,
  physicsToggle,
  setOverlay
}) => {
  const [vistOptions, setVisOptions] = useState([]);

  const handleToogleChange = (event, newOptions) => {
    if (newOptions.includes('autoLayout')) {
      physicsToggle(true);
    } else {
      physicsToggle(false);
    }

    if (newOptions.includes('hideLegend')) {
      legendContainerRef.current.style.display = 'none';
      networkContainerRef.current.style.width = '100%';
      circularProgressRef.current.style.left = '50%';
    } else {
      if (layoutContainerRef.current.style.display === 'flex') {
        layoutContainerRef.current.style.display = 'none';
      }
      legendContainerRef.current.style.display = 'block';
      networkContainerRef.current.style.width = '72%';
      circularProgressRef.current.style.left = '36%';
    }

    setVisOptions(newOptions);
  };

  const handleAttachOverlay = async () => {
    const filepaths = await window.glimpseAPI.getFilePaths();
    setOverlay(filepaths);
  };

  return (
    <Paper
      sx={{
        display: 'flex',
        height: '3.5rem',
        with: '100%',
        padding: '0.5rem',
        m: '0.5rem 1rem'
      }}
      elevation={2}
    >
      <Stack
        width={'100%'}
        spacing={1}
        divider={<Divider orientation="vertical" flexItem />}
        direction={'row'}
      >
        <Tooltip title="Add an Overlay">
          <Button onClick={handleAttachOverlay} color="#333333" variant="outlined" size="small">
            <Add />
          </Button>
        </Tooltip>

        <ToggleButtonGroup value={vistOptions} onChange={handleToogleChange}>
          <Tooltip title="Auto Layout">
            <ToggleButton value={'autoLayout'}>
              <InsightsRounded />
            </ToggleButton>
          </Tooltip>
          <ToggleButton value={'hideLegend'}>
            <Tooltip title="Hide Legend">
              <HideSource />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <ButtonGroup color="#333333" variant="outlined" size="small">
          <Tooltip title="Rotate CCW">
            <Button onClick={rotateCCW}>
              <RotateLeftSharp />
            </Button>
          </Tooltip>

          <Tooltip title="Rotate CW">
            <Button onClick={rotateCW}>
              <RotateRightSharp />
            </Button>
          </Tooltip>
        </ButtonGroup>

        <ButtonGroup color="#333333" variant="outlined" size="small">
          <Button onClick={prev}>Prev</Button>
          <Button onClick={next}>Next</Button>
        </ButtonGroup>
      </Stack>
    </Paper>
  );
};

export default VisRibbon;
