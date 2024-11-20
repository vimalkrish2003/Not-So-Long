import { useState } from 'react';
import { useAuth } from '../../contexts/authUserContext';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import roomServices from '../../services/roomServices';
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
import styles from './dashPage.module.css';

const DashPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStartCall = async () => {
    setIsLoading(true);
    try {
      const { roomId, host } = await roomServices.createRoom();
      navigate(`/room/${roomId}`, { 
        state: { 
          isHost: true,
          roomData: { roomId, host }
        }
      });
    } catch (error) {
      enqueueSnackbar(error.message || 'Failed to create room', { 
        variant: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCall = async () => {
    if (!roomId.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await roomServices.joinRoom(roomId);
      navigate(`/room/${roomId}`, { 
        state: { 
          isHost: response.host === user.id,
          roomData: response
        }
      });
    } catch (error) {
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to join room', 
        { variant: 'error' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box className={styles.container}>
        <Box className={styles.header}>
          <Typography variant="h4" className={styles.welcomeText}>
            Welcome {user?.name}
          </Typography>
          <Button 
            variant="outlined" 
            color="error" 
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Box>

        <Stack className={styles.buttonContainer} spacing={2} direction="row">
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartCall}
            size="large"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Room...' : 'Start New Call'}
          </Button>
          <Button 
            variant="outlined" 
            color="primary"
            onClick={() => setJoinDialogOpen(true)}
            size="large"
            disabled={isLoading}
          >
            Join Existing Call
          </Button>
        </Stack>

        <Dialog 
          open={joinDialogOpen} 
          onClose={() => !isLoading && setJoinDialogOpen(false)}
        >
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
              disabled={isLoading}
            />
          </DialogContent>
          <DialogActions className={styles.dialogActions}>
            <Button 
              onClick={() => setJoinDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleJoinCall} 
              variant="contained"
              disabled={isLoading || !roomId.trim()}
            >
              {isLoading ? 'Joining...' : 'Join'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default DashPage;