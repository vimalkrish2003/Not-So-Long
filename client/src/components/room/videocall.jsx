import { useState, useRef, useEffect } from "react";
import { Box } from "@mui/material";
import { usePeer } from "../../contexts/peerContext";
import { useSnackbar } from "notistack";
import roomServices from "../../services/roomServices";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";

const VideoCall = ({
  roomId,
  isMicOn,
  isVideoOn,
  isMovieModeActive,
  onInitialized,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pipRemoteVideoRef = useRef(null);
  const initRef = useRef(false);

  const { setLocalStream, remoteStream, peerConnection } = usePeer();

  useEffect(() => {
    const handleAudioToggle = async () => {
      const stream = localVideoRef.current?.srcObject;
      if (!stream) return;

      try {
        // Stop existing audio tracks
        stream.getAudioTracks().forEach((track) => {
          track.stop();
          stream.removeTrack(track);
        });

        if (isMicOn) {
          // Reinitialize audio if turning on
          const { stream: audioStream, error } =
            await roomServices.reinitializeTrack("audio");
          if (error) {
            enqueueSnackbar(error, { variant: "error" });
            return;
          }

          // Add new audio track to stream
          audioStream.getAudioTracks().forEach((track) => {
            stream.addTrack(track);
          });

          // Update peer connection
          if (peerConnection) {
            const sender = peerConnection
              .getSenders()
              .find((s) => s.track?.kind === "audio");
            if (sender) {
              sender.replaceTrack(audioStream.getAudioTracks()[0]);
            }
          }
        }

        // Update local stream reference
        setLocalStream(stream);
      } catch (err) {
        console.error("Audio toggle error:", err);
        enqueueSnackbar("Failed to toggle microphone", { variant: "error" });
      }
    };

    handleAudioToggle();
  }, [isMicOn, peerConnection, setLocalStream, enqueueSnackbar]);
  useEffect(() => {
    const handleVideoToggle = async () => {
      const stream = localVideoRef.current?.srcObject;
      if (!stream) return;

      try {
        // Stop existing video tracks
        stream.getVideoTracks().forEach((track) => {
          track.stop();
          stream.removeTrack(track);
        });

        if (isVideoOn) {
          // Reinitialize video if turning on
          const { stream: videoStream, error } =
            await roomServices.reinitializeTrack("video");
          if (error) {
            enqueueSnackbar(error, { variant: "error" });
            return;
          }

          // Add new video track to stream
          videoStream.getVideoTracks().forEach((track) => {
            stream.addTrack(track);
          });

          // Update peer connection
          if (peerConnection) {
            const sender = peerConnection
              .getSenders()
              .find((s) => s.track?.kind === "video");
            if (sender) {
              sender.replaceTrack(videoStream.getVideoTracks()[0]);
            }
          }
        }

        // Update local stream reference
        setLocalStream(stream);
      } catch (err) {
        console.error("Video toggle error:", err);
        enqueueSnackbar("Failed to toggle camera", { variant: "error" });
      }
    };

    handleVideoToggle();
  }, [isVideoOn, peerConnection, setLocalStream, enqueueSnackbar]);

  //Initialize remote stream
  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (pipRemoteVideoRef.current) {
        pipRemoteVideoRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  // Initialize media stream
  useEffect(() => {
    const initializeMedia = async () => {
      if (initRef.current) {
        console.log("Media already initialized");
        return;
      }

      try {
        const { stream, error } = await roomServices.initializeUserMedia();

        if (error) {
          enqueueSnackbar(error, { variant: "error" });
          return;
        }

        // Set stream in both local state and PeerContext
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Only notify parent after successful initialization
        initRef.current = true; // Mark as initialized using ref
        onInitialized();
      } catch (err) {
        console.error("Failed to initialize media:", err);
        enqueueSnackbar("Failed to access media devices", { variant: "error" });
      }
    };

    initializeMedia();

    return () => {
      if (localVideoRef.current?.srcObject) {
        roomServices.stopMediaStream(localVideoRef.current.srcObject);
      }
      initRef.current = false; // Reset on unmount
    };
  }, [enqueueSnackbar, setLocalStream, onInitialized]);

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
