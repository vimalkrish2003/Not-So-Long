import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { socket } from "../../services/socket";

/**
 * VideoCall Component
 * Handles WebRTC video call functionality with support for movie mode.
 * 
 * @param {Object} props
 * @param {string} props.roomId - Unique identifier for the video call room
 * @param {boolean} props.isMicOn - Microphone enabled state
 * @param {boolean} props.isVideoOn - Camera enabled state
 * @param {boolean} props.isMovieModeActive - Movie mode state
 */
const VideoCall = ({ roomId, isMicOn, isVideoOn, isMovieModeActive }) => {
  // Video element references
  const localVideoRef = useRef(null);    // Local camera feed
  const remoteVideoRef = useRef(null);   // Remote user's feed
  const peerConnection = useRef(null);    // WebRTC connection

  useEffect(() => {
    /**
     * Initialize WebRTC connection and media streams
     * Sets up peer connection, media tracks, and event handlers
     */
    const initializeWebRTC = async () => {
      try {
        // Get local media stream (camera/mic)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoOn,
          audio: isMicOn,
        });
        localVideoRef.current.srcObject = stream;

        // Initialize WebRTC peer connection
        peerConnection.current = new RTCPeerConnection();

        // Add local media tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, stream);
        });

        // Handle incoming remote media tracks
        peerConnection.current.ontrack = (event) => {
          remoteVideoRef.current.srcObject = event.streams[0];
        };

        // Handle ICE candidates for connection negotiation
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              roomId,
              candidate: event.candidate,
            });
          }
        };

        // Join the video call room
        socket.emit("join-room", roomId);
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    initializeWebRTC();
  }, [roomId, isMicOn, isVideoOn]);

  return (
    <Box sx={{ height: "100%", position: "relative" }}>
      {/* Main video area - Shows remote video in normal mode */}
      {!isMovieModeActive && (
        <video
          title="Remote Video"
          ref={remoteVideoRef} // Using remote video ref for main display
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      )}

      {/* Video overlay container */}
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
          display: "block",
          zIndex: 1250, // Ensures overlay appears above movie player
        }}
      >
        {/* Local video overlay in normal mode */}
        {!isMovieModeActive && (
          <video
            title="Local Video"
            ref={localVideoRef}
            autoPlay
            muted={true} // Mute local video to prevent feedback
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Remote video overlay in movie mode */}
        {isMovieModeActive && (
          <video
            title="Remote Video"
            ref={remoteVideoRef}
            autoPlay
            muted={false} // Keep remote audio in movie mode
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
      </Box>
    </Box>
  );
};

export default VideoCall;