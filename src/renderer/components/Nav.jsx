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
import MenuIcon from '@mui/icons-material/Menu';
import { SearchRounded } from '@mui/icons-material';
import { ArrowRight } from '@mui/icons-material';

const Nav = ({ onMount, showHome, graphData, findNode, findEdge }) => {
  const [openAbout, setOpenAbout] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [themesSubMenuAnchorEl, setThemesSubMenuAnchorEl] = useState(null);
  const [theme, setTheme] = useState('feeder-model-theme');
  const parentMenuRef = useRef(null);
  const openMenu = Boolean(menuAnchorEl);
  const openThemeSubMenu = Boolean(themesSubMenuAnchorEl);

  const options = useMemo(() => {
    if (!showSearch || !graphData.current) {
      return [];
    }

    const sortedEdgeIDs = graphData.current.edges
      .get()
      .sort((a, b) => -b.type.localeCompare(a.type));
    const sortedNodeIDs = graphData.current.nodes
      .get()
      .sort((a, b) => -b.type.localeCompare(a.type));
    return [...sortedEdgeIDs, ...sortedNodeIDs];
  }, [showSearch, graphData]);

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

      <About show={openAbout} close={() => setOpenAbout(false)} />
    </>
  );
};

export default Nav;
