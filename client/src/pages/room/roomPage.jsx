import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Box, Slide, Paper, IconButton, Stack, Slider } from "@mui/material";
import { useSnackbar } from "notistack";
import { useAuth } from "../../contexts/authUserContext";
import roomServices from "../../services/roomServices";
import { socket, connectSocket, disconnectSocket } from "../../services/socket";
import { useWebRTC } from "../../services/webrtc/useWebRTC";
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
  const location = useLocation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const moviePlayerRef = useRef(null);
  const timeRef = useRef(null);

  // Room state
  const [isHost, setIsHost] = useState(location.state?.isHost || false);
  const [roomData, setRoomData] = useState(location.state?.roomData || null);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // UI Controls state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMovieUploaded, setIsMovieUploaded] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isControlBarVisible, setControlBarVisible] = useState(true);
  const [isMovieModeActive, setIsMovieModeActive] = useState(false);
  const [movieProgress, setMovieProgress] = useState(0);
  const [isMoviePlaying, setIsMoviePlaying] = useState(false);

  // WebRTC integration
  const {
    localVideoRef,
    remoteVideoRef,
    initializeMediaStream,
    toggleAudio: toggleRTCAudio,
    toggleVideo: toggleRTCVideo,
    cleanup,
    connectionState: webRTCConnectionState,
    isAudioAvailable,
  } = useWebRTC({ roomId });

  // Initialize room and media
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        if (!location.state?.roomData) {
          try {
            const response = await roomServices.joinRoom(roomId);
            setRoomData(response);
            setIsHost(response.host === user.id);
            setHasJoinedRoom(true);

            // Initialize WebRTC first
            await initializeMediaStream();

            // Then connect socket with fresh token
            connectSocket();
            socket.emit("join-room", roomId);
          } catch (error) {
            if (error.message.includes("Room not found")) {
              const createResponse = await roomServices.createRoom();
              setRoomData(createResponse);
              setIsHost(true);
              setHasJoinedRoom(true);

              await initializeMediaStream();
              connectSocket();
              socket.emit("join-room", roomId);
            } else {
              throw error;
            }
          }
        } else {
          setHasJoinedRoom(true);
          await initializeMediaStream();
          connectSocket();
          socket.emit("join-room", roomId);
        }
      } catch (error) {
        console.error("Room initialization error:", error);
        enqueueSnackbar(error.message || "Failed to initialize room", {
          variant: "error",
        });
        navigate("/dash");
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();

    return () => {
      if (roomId && hasJoinedRoom) {
        cleanup();
        socket.emit("leave-room", roomId);
        disconnectSocket();
        roomServices.leaveRoom(roomId).catch(console.error);
      }
    };
  }, [
    roomId,
    location.state,
    navigate,
    user.id,
    enqueueSnackbar,
    initializeMediaStream,
    cleanup,
  ]);

  // Connection state monitoring
  useEffect(() => {
    if (
      webRTCConnectionState === "disconnected" ||
      webRTCConnectionState === "failed"
    ) {
      enqueueSnackbar("Connection lost. Attempting to reconnect...", {
        variant: "warning",
        autoHideDuration: 3000,
      });
    } else if (webRTCConnectionState === "connected") {
      enqueueSnackbar("Connection established", {
        variant: "success",
        autoHideDuration: 2000,
      });
    }
  }, [webRTCConnectionState, enqueueSnackbar]);

  // UI control handlers
  const toggleChat = () => setIsChatOpen((prev) => !prev);
  const toggleMic = useCallback(() => {
    if (!isAudioAvailable) {
      enqueueSnackbar("No microphone available", {
        variant: "warning",
        autoHideDuration: 2000,
      });
      return;
    }

    setIsMicOn((prev) => {
      const newState = !prev;
      if (hasJoinedRoom) {
        toggleRTCAudio(newState);
      }
      return newState;
    });
  }, [hasJoinedRoom, toggleRTCAudio, isAudioAvailable, enqueueSnackbar]);

  const toggleVideo = useCallback(() => {
    setIsVideoOn((prev) => {
      const newState = !prev;
      if (hasJoinedRoom) {
        toggleRTCVideo(newState); // This calls useWebRTC's toggle function
      }
      return newState;
    });
  }, [hasJoinedRoom, toggleRTCVideo]);
  const toggleMovieMode = () => setIsMovieModeActive((prev) => !prev);

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
    setIsMoviePlaying(!isMoviePlaying);
    if (moviePlayerRef.current) {
      moviePlayerRef.current.handlePlaybackToggle?.();
    }
  };

  const handleSeek = (_, value) => {
    setMovieProgress(value);
    if (moviePlayerRef.current) {
      moviePlayerRef.current.handleSeek?.(value);
    }
  };

  const handleFastForward = () => {
    if (moviePlayerRef.current) {
      moviePlayerRef.current.handleFastForward?.();
    }
  };

  const handleRewind = () => {
    if (moviePlayerRef.current) {
      moviePlayerRef.current.handleRewind?.();
    }
  };

  const handleUploadMovie = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        enqueueSnackbar("Please select a valid video file", {
          variant: "error",
        });
        return;
      }

      setIsMovieUploaded(true);
      if (moviePlayerRef.current) {
        moviePlayerRef.current.handleFileUpload?.(file);
      }
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
        />
      </Box>

      {false && (
        <Box className={styles.moviePlayer}>
          <MoviePlayer
            ref={moviePlayerRef}
            roomId={roomId}
            onPlayingChange={setIsMovieUploaded}
            isPlaying={isMoviePlaying}
            onProgressChange={setMovieProgress}
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
                  !isAudioAvailable || !isMicOn ? styles.muted : ""
                }`}
                disabled={!isAudioAvailable}
                title={
                  isAudioAvailable
                    ? "Toggle Microphone"
                    : "No microphone available"
                }
                size="large"
                sx={{
                  "&.Mui-disabled": {
                    opacity: 1, // Keep full opacity when disabled
                    color: "inherit", // Inherit the red color from muted class
                  },
                }}
              >
                {
                  isAudioAvailable ? (
                    isMicOn ? (
                      <MicIcon />
                    ) : (
                      <MicOffIcon />
                    )
                  ) : (
                    <MicOffIcon />
                  ) // Always show MicOffIcon when no audio available
                }
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
                    onClick={handleRewind}
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
                    onClick={handleFastForward}
                    className={styles.controlButton}
                    size="large"
                  >
                    <FastForwardIcon />
                  </IconButton>

                  <Slider
                    value={movieProgress}
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
