import { useEffect } from "react";
import { Box } from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { useWebRTC } from "../../services/webrtc";

const VideoCall = ({ roomId, isMicOn, isVideoOn, isMovieModeActive }) => {
  const {
    localVideoRef,
    remoteVideoRef,
    initializeMediaStream,
    toggleAudio,
    toggleVideo,
    cleanup,
  } = useWebRTC({ roomId });

// Single initialization effect
useEffect(() => {
  const init = async () => {
    try {
      await initializeMediaStream();
      // Initial states will be set after stream is established
      if (localVideoRef.current?.srcObject) {
        toggleAudio(isMicOn);
        toggleVideo(isVideoOn);
      }
    } catch (err) {
      console.error("Failed to initialize media stream:", err);
    }
  };
  init();

  return () => cleanup();
}, [initializeMediaStream, cleanup]); // Remove isMicOn and isVideoOn from deps

  // Handle audio toggle
  useEffect(() => {
    if (localVideoRef.current?.srcObject) {
      toggleAudio(isMicOn);
    }
  }, [isMicOn, toggleAudio]);

  // Handle video toggle
  useEffect(() => {
    if (localVideoRef.current?.srcObject) {
      toggleVideo(isVideoOn);
    }
  }, [isVideoOn, toggleVideo]);

  return (
    <Box sx={{ height: "100%", position: "relative" }}>
      {!isMovieModeActive && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            backgroundColor: "#000",
          }}
        />
      )}

      <Box
        sx={{
          position: "absolute",
          left: 16,
          bottom: 16,
          width: "200px",
          height: "150px",
          borderRadius: 2,
          overflow: "hidden",
          boxShadow: 3,
          bgcolor: "background.paper",
          zIndex: 1250,
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
        {!isVideoOn && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              zIndex: 1251,
            }}
          >
            <VideocamOffIcon sx={{ fontSize: 40, color: "white" }} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default VideoCall;
