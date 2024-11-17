import { useAuth } from '../../contexts/authUserContext';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Button, 
  Box, 
  Stack, 
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions 
} from '@mui/material';
import { useState } from 'react';
import styles from './dashPage.module.css';

const DashPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStartCall = () => {
    const newRoomId = Math.random().toString(36).substring(7);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinCall = () => {
    if (roomId.trim()) {
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <Container maxWidth="md">
      <Box className={styles.container}>
        <Box className={styles.header}>
          <Typography variant="h4" className={styles.welcomeText}>
            Welcome {user?.name}
          </Typography>
          <Button variant="outlined" color="error" onClick={handleLogout}>
            Logout
          </Button>
        </Box>

        <Stack className={styles.buttonContainer} spacing={2} direction="row">
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartCall}
            size="large"
          >
            Start New Call
          </Button>
          <Button 
            variant="outlined" 
            color="primary"
            onClick={() => setJoinDialogOpen(true)}
            size="large"
          >
            Join Existing Call
          </Button>
        </Stack>

        <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)}>
          <DialogTitle>Join Video Call</DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <TextField
              autoFocus
              margin="dense"
              label="Room ID"
              fullWidth
              variant="outlined"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
          </DialogContent>
          <DialogActions className={styles.dialogActions}>
            <Button onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleJoinCall} variant="contained">
              Join
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default DashPage;