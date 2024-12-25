import { useRef, useCallback, useEffect, useState } from "react";
import { socket } from "../socket";
import { RTC_CONFIG } from "./rtcConfig";

export const useWebRTC = ({ roomId }) => {
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isInitiator = useRef(false);
  const iceCandidatesQueue = useRef([]);
  const [connectionState, setConnectionState] = useState("new");
  const [isAudioAvailable, setIsAudioAvailable] = useState(false);
  const [isVideoAvailable, setIsVideoAvailable] = useState(false);

  // Initialize peer connection
  const initializePeerConnection = useCallback(async () => {
    try {
      peerConnection.current = new RTCPeerConnection(RTC_CONFIG);
      console.log("Peer connection created");

      // Handle remote tracks
      peerConnection.current.ontrack = ({ track, streams }) => {
        console.log("Remote track received:", track.kind);
        const [remoteStream] = streams;
        
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(console.error);
        }
      };

      // Handle connection state changes
      peerConnection.current.oniceconnectionstatechange = () => {
        const state = peerConnection.current.iceConnectionState;
        console.log("ICE Connection State:", state);
        setConnectionState(state);
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", {
            roomId,
            candidate: {
              sdpMLineIndex: candidate.sdpMLineIndex,
              sdpMid: candidate.sdpMid,
              candidate: candidate.candidate,
              usernameFragment: candidate.usernameFragment
            }
          });
        }
      };

      // Add existing tracks
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, localStream.current);
        });
      }

      return peerConnection.current;
    } catch (err) {
      console.error("Failed to create peer connection:", err);
      throw err;
    }
  }, [roomId]);

  // Initialize media stream
  const initializeMediaStream = useCallback(async () => {
    try {
      // Check device availability
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(device => device.kind === "audioinput");
      const hasVideo = devices.some(device => device.kind === "videoinput");

      setIsAudioAvailable(hasAudio);
      setIsVideoAvailable(hasVideo);

      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: hasAudio,
        video: hasVideo
      });

      // Set local stream
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize peer connection
      await initializePeerConnection();

      return stream;
    } catch (err) {
      console.error("Media stream error:", err);
      throw err;
    }
  }, [initializePeerConnection]);

  // Toggle audio/video functions
  const toggleAudio = useCallback(async (enabled) => {
    try {
      if (!localStream.current) return;
      const audioTracks = localStream.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
    } catch (err) {
      console.error("Toggle audio failed:", err);
    }
  }, []);

  const toggleVideo = useCallback(async (enabled) => {
    try {
      if (!localStream.current) return;
      const videoTracks = localStream.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
    } catch (err) {
      console.error("Toggle video failed:", err);
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        track.stop();
      });
      localStream.current = null;
    }
    
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Handle signaling
  useEffect(() => {
    const handleIceCandidate = async ({ candidate }) => {
      try {
        if (!peerConnection.current?.remoteDescription) {
          iceCandidatesQueue.current.push(candidate);
          return;
        }
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };

    socket.on("user-joined", async () => {
      console.log("User joined, creating offer");
      isInitiator.current = true;
      
      try {
        const offer = await peerConnection.current.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", { roomId, offer });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    });

    socket.on("offer", async (offer) => {
      try {
        if (!peerConnection.current) {
          await initializePeerConnection();
        }

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer", { roomId, answer });

        // Process queued candidates
        while (iceCandidatesQueue.current.length) {
          const candidate = iceCandidatesQueue.current.shift();
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async (answer) => {
      try {
        if (!peerConnection.current) return;
        
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process queued candidates
        while (iceCandidatesQueue.current.length) {
          const candidate = iceCandidatesQueue.current.shift();
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      cleanup();
    };
  }, [roomId, initializePeerConnection, cleanup]);

  return {
    localVideoRef,
    remoteVideoRef,
    initializeMediaStream,
    toggleAudio,
    toggleVideo,
    cleanup,
    connectionState,
    isAudioAvailable,
    isVideoAvailable
  };
};