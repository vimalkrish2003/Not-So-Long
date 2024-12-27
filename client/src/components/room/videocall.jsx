import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import { useWebRTC } from "../../services/webrtc/useWebRTC";

const VideoCall = ({ roomId, isMicOn, isVideoOn, isMovieModeActive }) => {
  const {
    localVideoRef,
    remoteVideoRef,
    localStream,
    remoteStream,
    initializeMediaStream,
    toggleAudio,
    toggleVideo,
    cleanup,
  } = useWebRTC({ roomId });

  const pipRemoteVideoRef = useRef(null);

  // Single initialization effect
  useEffect(() => {
    const init = async () => {
      try {
        await initializeMediaStream();
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
  }, [initializeMediaStream, cleanup]);

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

  useEffect(() => {
    if (
      isMovieModeActive &&
      remoteVideoRef.current?.srcObject &&
      pipRemoteVideoRef.current
    ) {
      // Switch to remote video in PiP when movie mode is active
      pipRemoteVideoRef.current.srcObject = remoteVideoRef.current.srcObject;
    } else if (!isMovieModeActive && pipRemoteVideoRef.current) {
      // Switch back to local video in PiP when movie mode is deactivated
      pipRemoteVideoRef.current.srcObject = null;
      if (localVideoRef.current?.srcObject && localStream?.current) {
        // Add null check for localStream
        localVideoRef.current.srcObject = localStream.current;
      }
    }
  }, [isMovieModeActive, localStream]); // Keep localStream in dependencies

  return (
    <Box sx={{ height: "100%", position: "relative" }}>
      {/* Main video display */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#000",
          display: isMovieModeActive ? "none" : "block",
        }}
      />

      {/* Picture-in-picture display */}
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
            display: isMovieModeActive ? "none" : "block",
          }}
        />
        <video
          ref={pipRemoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: isMovieModeActive ? "block" : "none",
          }}
        />
        {!isVideoOn && !isMovieModeActive && (
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
