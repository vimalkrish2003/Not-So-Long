import { useState,useEffect } from "react";
import { useAuth } from "../../contexts/authUserContext";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { socket } from "../../services/socket"; 
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
  DialogActions,
} from "@mui/material";
import styles from "./dashPage.module.css";

const DashPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Room creation response
    const handleRoomCreated = (roomData) => {
      setIsLoading(false);
      navigate(`/room/${roomData.roomId}`);
    };

    // Room join response
    const handleRoomJoined = (roomData) => {
      setIsLoading(false);
      setJoinDialogOpen(false);
      navigate(`/room/${roomData.roomId}`);
    };

    // Error handler
    const handleRoomError = (error) => {
      setIsLoading(false);
      enqueueSnackbar(error.message || "Room operation failed", {
        variant: "error",
      });
    };

    // Setup socket listeners
    socket.on("room-created", handleRoomCreated);
    socket.on("room-joined", handleRoomJoined);
    socket.on("room-error", handleRoomError);

    // Cleanup listeners
    return () => {
      socket.off("room-created", handleRoomCreated);
      socket.off("room-joined", handleRoomJoined);
      socket.off("room-error", handleRoomError);
    };
  }, [navigate, user.id, enqueueSnackbar]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleStartCall = async () => {
    setIsLoading(true);
    socket.emit("create-room");
  };

  const handleJoinCall = async () => {
    if (!roomId.trim()) return;
    setIsLoading(true);
    socket.emit('join-room', { roomId });
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
            disabled={isLoading}
          >
            {isLoading ? "Creating Room..." : "Start New Call"}
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
              {isLoading ? "Joining..." : "Join"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default DashPage;
