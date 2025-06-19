import React from 'react';
import '../styles/FileUpload.css';
import { Card, CardActionArea, CardContent, Typography } from '@mui/material';

const FileUpload = ({ onFileUpload }) => {
  // triggers the input when the button is clicked

  const handleUplaod = async () => {
    const paths = await window.glimpseAPI.getFilePaths();
    console.log(paths);
    if (paths) onFileUpload(paths);
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.stopPropagation();
    e.preventDefault();

    const paths = [];
    const files = e.dataTransfer.files;

    console.log(window.open());

    for (let file of files) {
      paths.push(window.Electron.webUtils.getPathForFile(file));
    }

    onFileUpload(paths);
  };

  const handleDragOver = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className="file-upload-form-container">
      <Card
        variant="outlined"
        sx={{
          border: '1px dashed #333333',
          height: '16rem',
          width: '28rem',
          borderRadius: '25px'
        }}
      >
        <CardActionArea
          sx={{ height: '100%' }}
          onClick={handleUplaod}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CardContent
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography variant="h5">File Upload</Typography>
            <Typography variant="body2">Drag and drop files here or click to upload</Typography>
            <ul>
              <li>GLM</li>
              <li>XML {'(CIM)'}</li>
              <li>
                JSON {'(Select Custom Theme)'}
                <ul style={{ paddingLeft: '1rem' }}>
                  <li>Networkx Node Link Data Dump</li>
                  <li>GLIMPSE Structure</li>
                </ul>
              </li>
            </ul>
          </CardContent>
        </CardActionArea>
      </Card>
    </div>
  );
};

export default FileUpload;
