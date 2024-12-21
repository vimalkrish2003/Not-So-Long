import { useEffect, useCallback } from "react";
import { Box } from "@mui/material";
import { socket } from "../../services/socket";
import { useWebRTC } from "../../services/webrtc";

const VideoCall = ({ roomId, isMicOn, isVideoOn, isMovieModeActive }) => {
  const {
    localVideoRef,
    remoteVideoRef,
    peerConnection,
    mediaStreamRef,
    isInitiator,
    cleanup,
    createPeerConnection,
    setupMediaStream,
    handleNegotiation,
    handleError
  } = useWebRTC({ roomId, isMicOn, isVideoOn });

  useEffect(() => {
    const handleConnectionStateChange = () => {
      if (peerConnection.current) {
        switch(peerConnection.current.connectionState) {
          case 'connected':
            console.log('Peers connected');
            break;
          case 'disconnected':
          case 'failed':
            handleError(new Error('Connection lost'), 'ConnectionState');
            break;
        }
      }
    };

    peerConnection.current?.addEventListener('connectionstatechange', handleConnectionStateChange);
    return () => peerConnection.current?.removeEventListener('connectionstatechange', handleConnectionStateChange);
  }, [handleError]);

  useEffect(() => {
    const initialize = async () => {
      cleanup();
      
      if (!createPeerConnection()) return;
      
      if (!await setupMediaStream()) return;

      socket.on('user-joined', () => {
        console.log('User joined, initiating connection');
        isInitiator.current = true;
        handleNegotiation();
      });

      socket.on('offer', async (offer) => {
        console.log('Received offer, creating answer');
        try {
          if (!peerConnection.current) return;
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit('answer', { roomId, answer });
        } catch (error) {
          handleError(error, 'HandleOffer');
        }
      });

      socket.on('answer', async (answer) => {
        try {
          if (!peerConnection.current) return;
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          handleError(error, 'HandleAnswer');
        }
      });

      socket.on('ice-candidate', async ({ candidate }) => {
        try {
          if (!peerConnection.current) return;
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          handleError(error, 'HandleIceCandidate');
        }
      });

      socket.emit('join-room', roomId);
    };

    initialize();

    return () => {
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      cleanup();
    };
  }, [roomId, isMicOn, isVideoOn, cleanup, createPeerConnection, setupMediaStream, handleNegotiation, handleError]);

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
          }}
        />
      </Box>
    </Box>
  );
};

export default VideoCall;