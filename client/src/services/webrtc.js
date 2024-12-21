import { useRef, useCallback } from "react";
import { socket } from "./socket";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const useWebRTC = ({ roomId, isMicOn, isVideoOn }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const mediaStreamRef = useRef(null);
  const isInitiator = useRef(false);

  // Define cleanup first since it's used in handleError
  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.enabled = false;
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (peerConnection.current) {
      // Clear event handlers
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.onconnectionstatechange = null;
      peerConnection.current.onnegotiationneeded = null;

      // Cleanup tracks
      try {
        peerConnection.current.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.enabled = false;
            sender.track.stop();
          }
        });

        peerConnection.current.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            receiver.track.enabled = false;
            receiver.track.stop();
          }
        });

        peerConnection.current.close();
      } catch (err) {
        console.error("Error during peer connection cleanup:", err);
      }
      peerConnection.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const handleError = useCallback((error, context) => {
    console.error(`WebRTC Error (${context}):`, error);
    cleanup();
  }, [cleanup]);

  const createPeerConnection = useCallback(() => {
    try {
      if (peerConnection.current) {
        peerConnection.current.close();
      }

      peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

      if (!peerConnection.current) {
        throw new Error('Failed to create peer connection');
      }

      // Set up event handlers
      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", { roomId, candidate });
        }
      };

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peerConnection.current.oniceconnectionstatechange = () => {
        const state = peerConnection.current?.iceConnectionState;
        console.log("ICE Connection State:", state);
        
        if (state === 'failed' || state === 'disconnected') {
          handleError(new Error(`ICE connection ${state}`), "ICEConnectionState");
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current?.connectionState;
        if (state === "failed") {
          handleError(new Error("Connection failed"), "PeerConnection");
        }
      };

      return true;
    } catch (error) {
      handleError(error, "CreatePeerConnection");
      return false;
    }
  }, [roomId, handleError]);

  const setupMediaStream = useCallback(async () => {
    try {
      const constraints = {
        video: isVideoOn ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } : false,
        audio: isMicOn ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (peerConnection.current && stream) {
        stream.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, stream);
        });
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      return true;
    } catch (error) {
      handleError(error, "SetupMediaStream");
      return false;
    }
  }, [isVideoOn, isMicOn, handleError]);

  const handleNegotiation = useCallback(async () => {
    try {
      if (!peerConnection.current || !isInitiator.current) return;

      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } catch (error) {
      handleError(error, "Negotiation");
    }
  }, [roomId, handleError]);

  return {
    localVideoRef,
    remoteVideoRef,
    peerConnection,
    mediaStreamRef,
    isInitiator,
    cleanup,
    createPeerConnection,
    setupMediaStream,
    handleNegotiation,
  };
};