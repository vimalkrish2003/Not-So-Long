import { useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Box, Slide, Paper, IconButton, Stack, Slider } from "@mui/material";
// Material UI Icons
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

/**
 * RoomPage Component
 * Provides video calling functionality with movie sharing capabilities.
 * Features:
 * - Video/Audio communication
 * - Movie playback and sharing
 * - Chat functionality
 * - Media controls
 */
const RoomPage = () => {
  const { roomId } = useParams();
  // Ref for controlling MoviePlayer component
  const moviePlayerRef = useRef(null);
  const timeRef=useRef(null);

  // State Management
  const [isChatOpen, setIsChatOpen] = useState(false); // Controls chat panel visibility
  const [isMovieUploaded, setIsMovieUploaded] = useState(false); // Movie upload state
  const [isMicOn, setIsMicOn] = useState(true); // Microphone state
  const [isVideoOn, setIsVideoOn] = useState(true); // Camera state
  const [isControlBarVisible, setControlBarVisible] = useState(true);
  const [isMovieModeActive, setIsMovieModeActive] = useState(false); // Movie mode toggle
  const [movieProgress, setMovieProgress] = useState(0); // Movie progress (0-100)
  const [isMoviePlaying, setIsMoviePlaying] = useState(false); // Movie play/pause state
  // Toggle Handlers
  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleVideo = () => setIsVideoOn(!isVideoOn);
  const toggleMovieMode = () => setIsMovieModeActive(!isMovieModeActive);

  /**
   * Handles movie playback toggle and communicates with MoviePlayer component
   */
  const toggleMoviePlayback = () => {
    setIsMoviePlaying(!isMoviePlaying);
    if (moviePlayerRef.current) {
      //moviePlayerRef.current.handlePlaybackToggle();
    }
  };

  const handleMouseEnter = useCallback(() => {
    if(timeRef.current){
      clearTimeout(timeRef.current);
    }

    setControlBarVisible(true);
  },[]);
  const handleMouseLeave = useCallback(() => {
    timeRef.current=setTimeout(()=>{
      setControlBarVisible(false);
    },1000);
  },[]);

  /**
   * Handles seeking in the movie timeline
   * @param {Event} _ - Unused event parameter
   * @param {number} value - New progress value (0-100)
   */
  const handleSeek = (_, value) => {
    setMovieProgress(value);
    if (moviePlayerRef.current) {
      // moviePlayerRef.current.handleSeek(value);
    }
  };

  // Movie Control Handlers
  const handleFastForward = () => {
    if (moviePlayerRef.current) {
      // moviePlayerRef.current.handleFastForward();
    }
  };

  const handleRewind = () => {
    if (moviePlayerRef.current) {
      //moviePlayerRef.current.handleRewind();
    }
  };

  /**
   * Handles movie file upload via file input
   * Triggers movie playback when file is selected
   */
  const handleUploadMovie = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Check if file is video type
      if (!file.type.startsWith("video/")) {
        alert("Please select a valid video file");
        return;
      }

      // Proceed with valid video file
      setIsMovieUploaded(true);
      if (moviePlayerRef.current) {
        moviePlayerRef.current.handleFileUpload(file);
      }
    };

    input.click();
  };

  return (
    <Box className={styles.container}>
      {/* Video Call Section */}
      <Box className={styles.videoContainer}>
        <VideoCall
          roomId={roomId}
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          isMovieModeActive={isMovieModeActive}
        />
      </Box>

      {/* Movie Player Section - Currently set as Disabled always for developement. Do Not Change this Code */}
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

      {/* Chat Panel - Slides in from left */}
      <Slide direction="left" in={isChatOpen} timeout={300}>
        <Box className={styles.chatPanel}>
          <ChatInterface roomId={roomId} />
        </Box>
      </Slide>

      {/* Control Bar */}
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
              {/* Video Call Controls */}
              <>
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
              </>

              {/* Chat Toggle */}
              <IconButton
                onClick={toggleChat}
                className={`${styles.controlButton} ${
                  isChatOpen ? styles.activeButton : ""
                }`}
                size="large"
              >
                <ChatIcon />
              </IconButton>

              {/* Movie Mode Toggle */}
              <IconButton
                onClick={toggleMovieMode}
                className={`${styles.controlButton} ${
                  isMovieModeActive ? styles.activeButton : ""
                }`}
                size="large"
              >
                <MovieIcon />
              </IconButton>

              {/* Movie Controls - Only shown in movie mode */}
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

                  {/* Progress Slider */}
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
