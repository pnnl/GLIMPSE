import React, { useEffect, useState, useMemo } from 'react';
import '../styles/Nav.css';
import About from './About';
import { Autocomplete, Stack, Toolbar, TextField, IconButton } from '@mui/material';
import { SearchRounded } from '@mui/icons-material';

const Nav = ({ onMount, showHome, graphData, findNode, findEdge }) => {
  const [open, setOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchValue, setSearchValue] = useState(null);

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
  }, [showSearch, graphData.current]);

  const handleAboutBtn = (e) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleSearch = () => {
    if (searchValue.elementType === 'node') findNode.current(searchValue);
    else if (searchValue.elementType === 'edge') findEdge.current(searchValue);
    else alert(`${searchValue.id} is not in the graph.`);
  };

  useEffect(() => {
    onMount(setShowSearch);
  });

  return (
    <>
      <Toolbar variant="dense" sx={{ width: '100%' }}>
        <img className="nav-logo" src="./imgs/GLIMPSE/GLIMPSE_logo.png" alt="GLIMPSE LOGO" />
        {showSearch && (
          <Autocomplete
            sx={{ margin: '0 auto', width: '50%' }}
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

      <About show={open} close={() => setOpen(false)} />
    </>
  );
};

export default Nav;
