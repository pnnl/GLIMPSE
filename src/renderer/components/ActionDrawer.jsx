import React, { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  Box,
  Drawer,
  IconButton,
  Divider,
  TextField,
  Stack,
  Tooltip
} from '@mui/material';
import { ChevronLeft, SearchRounded, TuneRounded } from '@mui/icons-material';
import StatsTableModal from './StatsTableModal';
import PlotModal from './PlotModal';
import axios from 'axios';
import {
  CustomFab,
  CustomSwitch,
  CustomFormControlLabel,
  CustomButton
} from '../utils/CustomComponents';
import NatigConfigModal from './NatigConfigModal';
const { appOptions } = JSON.parse(await window.glimpseAPI.getConfig());

const ActionDrawer = ({
  physicsToggle,
  setOverlay,
  applyOverlay,
  removeOverlay,
  reset,
  modelNumber,
  getSwitches,
  networkContainerRef,
  legendContainerRef,
  layoutContainerRef
}) => {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [hideRemoveOverlayBtn, setHideRemoveOverlayBtn] = useState('none');
  const [imgUrl, setImgUrl] = useState(null);
  const [showPlot, setShowPlot] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [stats, setStats] = useState(null);
  const [openNatigConfig, setOpenNatigConfig] = useState(false);

  const autoLayout = (e) => {
    physicsToggle(e.target.checked);
  };

  const closeDrawer = () => {
    setOpenDrawer(false);
  };

  const handleRemoveOverlay = () => {
    setHideRemoveOverlayBtn('none');
    removeOverlay();
  };

  /**
   * Send the entire graph data object to the main process and extract statistic using networkx
   */
  const showStats = async () => {
    if (stats === null) {
      const response = await axios.get('http://127.0.0.1:5173/get-stats');

      setStats(response.data);

      setShowTable(true);
    } else {
      setShowTable(true);
    }
  };

  const getPlotImg = ({ buffer }) => {
    const imgUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));

    setImgUrl(imgUrl);
    setShowPlot(true);
  };

  const toggleLegend = (e) => {
    const circularProgress = document.getElementById('circularProgress');

    if (e.target.checked) {
      legendContainerRef.current.style.display = 'none';
      networkContainerRef.current.style.width = '100%';
      circularProgress.style.left = '50%';
    } else {
      if (layoutContainerRef.current.style.display === 'flex') {
        layoutContainerRef.current.style.display = 'none';
      }
      legendContainerRef.current.style.display = 'block';
      networkContainerRef.current.style.width = '72%';
      circularProgress.style.left = '36%';
    }
  };

  const handleAttachOverlay = async () => {
    const filepaths = await window.glimpseAPI.getFilePaths();
    setOverlay(filepaths, setHideRemoveOverlayBtn);
    setOpenDrawer(false);
  };

  useEffect(() => {
    const removeListenersArr = [];
    removeListenersArr.push(window.glimpseAPI.getEmbeddingsPlot(getPlotImg));
    removeListenersArr.push(window.glimpseAPI.onGetMetrics(showStats));

    return () => {
      for (let removeListener of removeListenersArr) {
        removeListener();
      }
    };
  });

  return (
    <Box>
      <Stack spacing={1} direction={'row'} sx={{ position: 'absolute', margin: 1 }}>
        <Tooltip title="Vis Options" placement="bottom-end">
          <CustomFab size="medium" variant="extended" onClick={() => setOpenDrawer(true)}>
            <TuneRounded />
          </CustomFab>
        </Tooltip>

        <CustomFab size="medium" onClick={reset} variant="extended">
          Reset
        </CustomFab>

        <CustomFab
          size="medium"
          sx={{ display: hideRemoveOverlayBtn }}
          variant="extended"
          onClick={handleRemoveOverlay}
        >
          Remove Overlay
        </CustomFab>
      </Stack>
      <Drawer
        variant="persistent"
        anchor="top"
        open={openDrawer}
        onClose={closeDrawer}
        // onPointerLeave={closeDrawer}
        sx={{
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: 240, top: '4rem', boxSizing: 'border-box' }
        }}
      >
        <CustomFormControlLabel
          control={<CustomSwitch size="medium" onChange={autoLayout} />}
          label={appOptions.buttons.layoutLbl}
          labelPlacement="start"
        />

        <Divider />

        <CustomFormControlLabel
          control={<CustomSwitch size="medium" onChange={toggleLegend} />}
          label="Hide Legend"
          labelPlacement="start"
        />

        <Divider />

        <CustomButton sx={{ borderRadius: '0' }} variant="text" onClick={handleAttachOverlay}>
          Attach an Overlay
        </CustomButton>
        <Divider />
        <CustomButton
          sx={{ borderRadius: '0' }}
          variant="text"
          onClick={() => setOpenNatigConfig(true)}
        >
          Scenario Configuration
        </CustomButton>

        <Divider />
      </Drawer>
      <NatigConfigModal
        open={openNatigConfig}
        close={() => setOpenNatigConfig(false)}
        modelNumber={modelNumber}
        applyOverlay={applyOverlay}
        showRemoveOverlayBtn={setHideRemoveOverlayBtn}
        getSwitches={getSwitches}
      />
      <StatsTableModal show={showTable} data={stats} close={() => setShowTable(false)} />
      <PlotModal plot={imgUrl} show={showPlot} close={() => setShowPlot(false)} />
    </Box>
  );
};

export default ActionDrawer;
