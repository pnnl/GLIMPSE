import React, { useState, useRef, useMemo, useEffect } from 'react';
import '../styles/Nav.css';
import About from './About';
import {
  Stack,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  Autocomplete,
  TextField
} from '@mui/material';
import NatigConfigModal from './NatigConfigModal';
import MenuIcon from '@mui/icons-material/Menu';
import { SearchRounded } from '@mui/icons-material';
import { ArrowRight } from '@mui/icons-material';

const Nav = ({ onMount, showHome, graphData, findNode, findEdge, modelNumber, applyOverlay }) => {
  const [openAbout, setOpenAbout] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [openConfig, setOpenConfig] = useState(false);
  const [themesSubMenuAnchorEl, setThemesSubMenuAnchorEl] = useState(null);
  const [theme, setTheme] = useState('feeder-model-theme');
  const [watchData, setWatchData] = useState(null);
  const parentMenuRef = useRef(null);
  const openMenu = Boolean(menuAnchorEl);
  const openThemeSubMenu = Boolean(themesSubMenuAnchorEl);

  const sortedEdgeIDs = useMemo(() => {
    if (!showSearch || !graphData.current || !graphData.current.edges) {
      return [];
    }
    // console.log('Recalculating sortedEdgeIDs'); // For debugging
    return graphData.current.edges
      .get()
      .slice() // Create a shallow copy before sorting to avoid mutating the original, if applicable
      .sort((a, b) => -b.type.localeCompare(a.type));
  }, [showSearch, graphData.current?.edges]); // Depends on showSearch and the edges collection itself

  // Memoize sorted nodes
  const sortedNodeIDs = useMemo(() => {
    if (!showSearch || !graphData.current || !graphData.current.nodes) {
      return [];
    }
    // console.log('Recalculating sortedNodeIDs'); // For debugging
    return graphData.current.nodes
      .get()
      .slice() // Create a shallow copy before sorting
      .sort((a, b) => -b.type.localeCompare(a.type));
  }, [showSearch, graphData.current?.nodes]); // Depends on showSearch and the nodes collection itself

  // Combine memoized sorted lists
  const options = useMemo(() => {
    if (!showSearch) {
      // Primary guard based on visibility
      return [];
    }
    // console.log('Recalculating combined options'); // For debugging
    return [...sortedEdgeIDs, ...sortedNodeIDs];
  }, [showSearch, sortedEdgeIDs, sortedNodeIDs]); // Depends on showSearch and the memoized sorted arrays

  const handleMenuClick = (e) => {
    setMenuAnchorEl(e.currentTarget);
  };

  const handleAboutBtn = (e) => {
    e.preventDefault();
    setOpenAbout(true);
  };

  const closeMenu = () => {
    setMenuAnchorEl(null);

    if (openThemeSubMenu) setThemesSubMenuAnchorEl(null);
  };

  const showThemesSubmenu = () => {
    setThemesSubMenuAnchorEl(parentMenuRef.current);
  };

  const closeThemesSubmenu = (e) => {
    const { value } = e.target;

    if (value === theme || value === undefined) {
      setThemesSubMenuAnchorEl(null);
    } else {
      setTheme(e.target.value);
      setThemesSubMenuAnchorEl(null);
    }
  };

  const showWatchWindow = () => {
    console.log('showwatch');
    window.glimpseAPI.openPortalWindow({
      component: 'Watch',
      props: { watchData: watchData }
    });
  };

  const handleSearch = () => {
    if (searchValue.elementType === 'node') findNode.current(searchValue);
    else if (searchValue.elementType === 'edge') findEdge.current(searchValue);
    else alert(`${searchValue.id} is not in the graph.`);
  };

  useEffect(() => {
    onMount(setShowSearch);
  }, [setShowSearch, onMount]);

  return (
    <>
      <Toolbar variant="dense" sx={{ width: '100%' }}>
        <IconButton size="medium" onClick={handleMenuClick}>
          <MenuIcon />
        </IconButton>
        <Menu id="nav-menu" anchorEl={menuAnchorEl} open={openMenu} onClose={closeMenu}>
          <MenuItem disabled ref={parentMenuRef} onClick={showThemesSubmenu}>
            <ListItemText>Themes</ListItemText>
            <ListItemIcon sx={{ justifyContent: 'flex-end' }} onPointerEnter={showThemesSubmenu}>
              <ArrowRight />
            </ListItemIcon>
          </MenuItem>
          <MenuItem onClick={() => setOpenConfig(true)}>Scenerion Config</MenuItem>
          <MenuItem onClick={showWatchWindow}>Watching</MenuItem>
        </Menu>
        <Menu
          id="themes-submenu"
          anchorEl={themesSubMenuAnchorEl}
          anchorOrigin={{
            horizontal: 'right',
            vertical: 'top'
          }}
          open={openThemeSubMenu}
          onClose={closeMenu}
        >
          <MenuItem>Export Theme</MenuItem>
          <Divider />
          <FormControl sx={{ padding: '0 16px' }} onPointerLeave={closeThemesSubmenu}>
            <FormLabel>Themes</FormLabel>
            <RadioGroup value={theme} onChange={closeThemesSubmenu}>
              <FormControlLabel value="feeder-model-theme" control={<Radio />} label="Power Grid" />
              <FormControlLabel value="custom-theme" control={<Radio />} label="Custom" />
            </RadioGroup>
          </FormControl>
        </Menu>
        <img className="nav-logo" src="./imgs/GLIMPSE/GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
        {showSearch && (
          <Autocomplete
            sx={{ margin: '0 auto', width: '45%' }}
            size="small"
            options={options}
            groupBy={(option) => option.type}
            getOptionLabel={(option) => option.id}
            onChange={(event, option) => setSearchValue(option)}
            renderInput={(params) => (
              <Stack sx={{ m: 1 }} direction="row" spacing={1}>
                <IconButton onClick={handleSearch}>
                  <SearchRounded />
                </IconButton>
                <TextField variant="outlined" {...params} label={'Search...'} />
              </Stack>
            )}
          />
        )}
        <Stack direction={'row'} spacing={1} sx={showSearch ? {} : { marginLeft: 'auto' }}>
          <button className="header-btn" onClick={showHome}>
            Home
          </button>
          <button className="header-btn" onClick={handleAboutBtn}>
            About
          </button>
        </Stack>
      </Toolbar>

      <NatigConfigModal
        open={openConfig}
        modelNumber={modelNumber}
        close={() => {
          setOpenConfig(false);
          closeMenu();
        }}
        applyOverlay={applyOverlay}
        graphData={graphData}
        setWatchData={setWatchData}
      />
      <About show={openAbout} close={() => setOpenAbout(false)} />
    </>
  );
};

export default Nav;
