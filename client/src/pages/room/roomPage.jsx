import { useState, useRef, useCallback ,useEffect} from "react";
import { useParams } from "react-router-dom";
import { Box, Slide, Paper, IconButton, Stack, Slider } from "@mui/material";
import { useAuth } from "../../contexts/authUserContext";
import { useSocket } from "../../contexts/socketContext";
import { useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import { usePeer } from "../../contexts/peerContext";
import { ControlMessageTypes } from "../../configs/peerConfig";
// Material UI Icons
import CircularProgress from "@mui/material/CircularProgress";
import ChatIcon from "@mui/icons-material/Chat";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MovieIcon from "@mui/icons-material/Movie";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FastForwardIcon from "@mui/icons-material/FastForward";
import FastRewindIcon from "@mui/icons-material/FastRewind";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
// Components
import VideoCall from "../../components/room/videocall";
import MoviePlayer from "../../components/room/movieplayer";
import ChatInterface from "../../components/room/chatInterface";
import styles from "./roomPage.module.css";

const RoomPage = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const { registerControlHandler, sendControl } = usePeer();
  const { enqueueSnackbar } = useSnackbar();
  const moviePlayerRef = useRef(null);
  const location = useLocation();
  const timeRef = useRef(null);

  // UI Controls state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMovieUploaded, setIsMovieUploaded] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isControlBarVisible, setControlBarVisible] = useState(true);
  const [isMovieModeActive, setIsMovieModeActive] = useState(false);
  const [movieProgress, setMovieProgress] = useState(0);
  const [isMoviePlaying, setIsMoviePlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // UI control handlers
  const toggleChat = () => setIsChatOpen((prev) => !prev);
  const toggleMic = () => setIsMicOn((prev) => !prev);
  const toggleVideo = () => setIsVideoOn((prev) => !prev);
  const toggleMovieMode = useCallback(() => {
    setIsMovieModeActive(prev => {
      const newState = !prev;
      // Send update to peer after state change
      sendControl(ControlMessageTypes.MOVIE_MODE_ISACTIVE, {
        isActive: newState,
        timestamp: Date.now()
      });
      return newState;
    });
  }, [sendControl]);

  useEffect(() => {
    if (location.state?.roomData) {
      try {
        // Listen for errors
        socket.on("room-error", (error) => {
          enqueueSnackbar(error.message, { variant: "error" });
        });
      } catch (err) {
        console.error("Room join error:", err);
        enqueueSnackbar("Failed to join room", { variant: "error" });
      }
    }

    // Cleanup listeners
    return () => {
      socket.off("room-error");
    };
  }, [roomId, user, location?.state, enqueueSnackbar]);


  useEffect(() => {
    const cleanup = registerControlHandler(
      ControlMessageTypes.MOVIE_MODE_ISACTIVE, 
      (payload) => {
        console.log("Received movie mode update:", payload);
        setIsMovieModeActive(payload.isActive);
      }
    );

    return cleanup;
  }, [registerControlHandler]);



  const handleVideoComponentInitialized = useCallback(() => {
    if (roomId && user) {
      console.log("Emitting User Joined")
      socket.emit("user-joined", {
        roomId,
        user,
      });
    }
  }, [ roomId, user,socket]);

  //Old Functions to down

  const handleMouseEnter = useCallback(() => {
    if (timeRef.current) {
      clearTimeout(timeRef.current);
    }
    setControlBarVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeRef.current = setTimeout(() => {
      setControlBarVisible(false);
    }, 1000);
  }, []);

  // Movie control handlers
  const toggleMoviePlayback = () => {
    setIsMoviePlaying((prev) => !prev);
  };

  const handleSeek = (_, value) => {
    setMovieProgress(value);
  };

  const handleUploadMovie = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        return;
      }

      setIsMovieUploaded(true);
    };

    input.click();
  };

  if (isLoading) {
    return (
      <Box
        className={styles.container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className={styles.container}>
      <Box className={styles.videoContainer}>
        <VideoCall
          roomId={roomId}
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          isMovieModeActive={isMovieModeActive}
          onInitialized={handleVideoComponentInitialized}
        />
      </Box>

      {false && (
        <Box className={styles.moviePlayer}>
          <MoviePlayer
            ref={moviePlayerRef}
            roomId={roomId}
            onPlayingChange={setIsMovieUploaded}
            isPlaying={isMoviePlaying}
          />
        </Box>
      )}

      <Slide direction="left" in={isChatOpen} timeout={300}>
        <Box className={styles.chatPanel}>
          <ChatInterface roomId={roomId} />
        </Box>
      </Slide>

      <Box
        className={styles.controlBarContainer}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="toolbar"
        aria-label="Control Bar"
      >
        <Slide
          direction="up"
          in={isControlBarVisible}
          timeout={300}
          mountOnEnter
          unmountOnExit
        >
          <Paper elevation={3} className={`${styles.controlBar} controlBar`}>
            <Stack
              direction="row"
              spacing={2}
              className={styles.controls}
              alignItems="center"
            >
              <IconButton
                onClick={toggleMic}
                className={`${styles.controlButton} ${
                  !isMicOn ? styles.muted : ""
                }`}
                size="large"
              >
                {isMicOn ? <MicIcon /> : <MicOffIcon />}
              </IconButton>

              <IconButton
                onClick={toggleVideo}
                className={`${styles.controlButton} ${
                  !isVideoOn ? styles.muted : ""
                }`}
                size="large"
              >
                {isVideoOn ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>

              <IconButton
                onClick={toggleChat}
                className={`${styles.controlButton} ${
                  isChatOpen ? styles.activeButton : ""
                }`}
                size="large"
              >
                <ChatIcon />
              </IconButton>

              <IconButton
                onClick={toggleMovieMode}
                className={`${styles.controlButton} ${
                  isMovieModeActive ? styles.activeButton : ""
                }`}
                size="large"
              >
                <MovieIcon />
              </IconButton>

              {isMovieModeActive && (
                <Box
                  className={styles.movieControls}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    onClick={handleUploadMovie}
                    className={styles.controlButton}
                    size="large"
                  >
                    <CloudUploadIcon />
                  </IconButton>

                  <IconButton
                    onClick={() => {}}
                    className={styles.controlButton}
                    size="large"
                  >
                    <FastRewindIcon />
                  </IconButton>

                  <IconButton
                    onClick={toggleMoviePlayback}
                    className={styles.controlButton}
                    size="large"
                  >
                    {isMoviePlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>

                  <IconButton
                    onClick={() => {}}
                    className={styles.controlButton}
                    size="large"
                  >
                    <FastForwardIcon />
                  </IconButton>

                  <Slider
                    value={Number.isFinite(movieProgress) ? movieProgress : 0}
                    onChange={handleSeek}
                    className={styles.progressSlider}
                    min={0}
                    max={100}
                    step={1}
                    disabled={!isMovieUploaded}
                    sx={{
                      "& .MuiSlider-thumb": {
                        width: 12,
                        height: 12,
                        backgroundColor: "#fff",
                      },
                      "& .MuiSlider-track": {
                        backgroundColor: "primary.main",
                      },
                      "& .MuiSlider-rail": {
                        backgroundColor: "rgba(255, 255, 255, 0.3)",
                      },
                    }}
                  />
                </Box>
              )}
            </Stack>
          </Paper>
        </Slide>
      </Box>
    </Box>
  );
};

export default RoomPage;
