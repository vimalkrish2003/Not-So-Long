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
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const cleanup = () => {
      // First release all media tracks
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
        mediaStreamRef.current = null;
      }

      // Close peer connection
      if (peerConnection.current) {
        try {
          peerConnection.current.getSenders().forEach(sender => {
            if (sender.track) {
              sender.track.enabled = false;
              sender.track.stop();
            }
          });
          peerConnection.current.getReceivers().forEach(receiver => {
            if (receiver.track) {
              receiver.track.enabled = false;
              receiver.track.stop();
            }
          });
          peerConnection.current.close();
        } catch (err) {
          console.error('Error during peer connection cleanup:', err);
        }
        peerConnection.current = null;
      }

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      // Remove socket listeners
      socket.off("join-room");
      socket.off("ice-candidate");
    };

    const initializeWebRTC = async () => {
      try {
        if (!mounted) return;
        
        if (isVideoOn || isMicOn) {
          // Get user media
          const stream = await navigator.mediaDevices.getUserMedia({
            video: isVideoOn,
            audio: isMicOn,
          });

          if (!mounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }

          mediaStreamRef.current = stream;
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          // Setup peer connection
          peerConnection.current = new RTCPeerConnection();
          
          stream.getTracks().forEach(track => {
            peerConnection.current.addTrack(track, stream);
          });

          peerConnection.current.ontrack = (event) => {
            if (remoteVideoRef.current && mounted) {
              remoteVideoRef.current.srcObject = event.streams[0];
            }
          };

          peerConnection.current.onicecandidate = (event) => {
            if (event.candidate && mounted) {
              socket.emit("ice-candidate", { roomId, candidate: event.candidate });
            }
          };

          socket.emit("join-room", roomId);
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    initializeWebRTC();

    return () => {
      mounted = false;
      cleanup();
    };
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
