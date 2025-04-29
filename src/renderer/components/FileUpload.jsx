import React from 'react';
import '../styles/FileUpload.css';
import Button from '@mui/material/Button';
import { UploadFile } from '@mui/icons-material';

const FileUpload = ({ onFileUpload }) => {
  // triggers the input when the button is clicked

  const handleUplaod = async () => {
    const paths = await window.glimpseAPI.getFilePaths();
    if (paths) onFileUpload(paths);
  };

  return (
    <div className="file-upload-form-container">
      <Button
        sx={{
          padding: '1rem',
          borderWidth: '2px',
          borderRadius: '1rem',
          borderStyle: 'dashed',
          borderColor: '#333333',
          color: '#333333',
          ':hover': { backgroundColor: '#F8FAFC' }
        }}
        startIcon={<UploadFile />}
        variant="text"
        onClick={handleUplaod}
      >
        Upload Files
      </Button>
    </div>
  );
};

export default FileUpload;
