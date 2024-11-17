// src/components/watchParty/FileUpload.jsx
import { useState } from 'react';
import { Button, Alert } from '@mui/material';

const FileUpload = ({ onFileSelect }) => {
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    const maxSize = 3000 * 1024 * 1024; // 3GB limit
    
    if (file) {
      if (file.size > maxSize) {
        setError('File size too large (max 3GB)');
        return;
      }
      
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      
      setError('');
      onFileSelect(file);
    }
  };

  return (
    <div>
      <Button variant="contained" component="label">
        Upload Video
        <input
          type="file"
          hidden
          accept="video/*"
          onChange={handleFileChange}
        />
      </Button>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </div>
  );
};

export default FileUpload;