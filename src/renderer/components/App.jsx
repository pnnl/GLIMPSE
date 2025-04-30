import React, { useRef, useState } from 'react';
import { handleFileUpload } from '../utils/appUtils';
import { LinearProgress, Box } from '@mui/material';
import FileUpload from './FileUpload';
import Graph from './Graph';
import Nav from './Nav';

const App = () => {
  const [fileData, setFileData] = useState({ loading: false });
  const [filesUploaded, setFilesUploaded] = useState(false);
  const graphDataRef = useRef(null);
  const findNodeRef = useRef(null);
  const findEdgeRef = useRef(null);
  let setShowSearch = null;

  // function to get the graphData object form child component
  const setSearchReqs = ({ graphData, findNode, findEdge }) => {
    graphDataRef.current = graphData;
    findNodeRef.current = findNode;
    findEdgeRef.current = findEdge;
    setShowSearch(true);
  };

  const showHome = () => {
    setFilesUploaded(false);
    setFileData({ loading: false });
    setShowSearch(false);
  };

  // get the nav's setShowSearch state function to show the search field
  // when getting the graph data from the Graph child component
  const onMount = (navSetShowSearch) => {
    setShowSearch = navSetShowSearch;
  };

  return (
    <>
      <Nav
        onMount={onMount}
        showHome={showHome}
        graphData={graphDataRef}
        findNode={findNodeRef}
        findEdge={findEdgeRef}
      />
      {!filesUploaded && (
        <FileUpload
          onFileUpload={(paths) => handleFileUpload(paths, setFileData, setFilesUploaded)}
        />
      )}
      {fileData.loading && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress />
        </Box>
      )}

      {filesUploaded && !fileData.loading && (
        <Graph
          dataToVis={fileData.visData}
          theme={fileData.theme}
          isGlm={fileData.isGlm}
          isCim={fileData.isCim}
          findNodeRef={findNodeRef}
          findEdgeRef={findEdgeRef}
          setSearchReqs={setSearchReqs}
        />
      )}
    </>
  );
};

export default App;
