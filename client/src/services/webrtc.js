// services/webrtc.js
import { useRef, useCallback, useEffect } from "react";
import { socket } from "./socket";

// WebRTC Configuration
const RTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
    {
      urls: ["turn:numb.viagenie.ca"],
      username: "webrtc@live.com",
      credential: "muazkh",
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: "all",
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  sdpSemantics: "unified-plan",
};

// Media Stream Constraints
const MEDIA_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
    facingMode: "user",
    echoCancellation: true,
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    sampleSize: 16,
  },
};

export const useWebRTC = ({ roomId }) => {
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(new MediaStream());
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isInitiator = useRef(false);

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
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

  // Initialize media devices and stream
  const initializeMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: MEDIA_CONSTRAINTS.audio,
        video: MEDIA_CONSTRAINTS.video
      });

      localStream.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      await initializePeerConnection();
      return stream;
    } catch (err) {
      console.error("Failed to get user media:", err);
      throw err;
    }
  }, []);

  // Initialize peer connection
  const initializePeerConnection = useCallback(async () => {
    try {
      peerConnection.current = new RTCPeerConnection(RTC_CONFIG);

      // Add local tracks to peer connection
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, localStream.current);
        });
      }

      // Handle remote tracks
      peerConnection.current.ontrack = ({ track, streams: [stream] }) => {
        track.onunmute = () => {
          if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = stream;
          }
        };
      };

      // ICE candidate handling
      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", { roomId, candidate });
        }
      };

      // Connection state monitoring
      peerConnection.current.onconnectionstatechange = () => {
        console.log(
          "Connection state:",
          peerConnection.current.connectionState
        );
        if (peerConnection.current.connectionState === "failed") {
          handleReconnection();
        }
      };

      // ICE connection state monitoring
      peerConnection.current.oniceconnectionstatechange = () => {
        console.log("ICE state:", peerConnection.current.iceConnectionState);
      };

      return peerConnection.current;
    } catch (err) {
      console.error("Failed to create peer connection:", err);
      throw err;
    }
  }, [roomId]);

  // Handle media controls
  // Handle media controls
  const toggleAudio = useCallback(async (enabled) => {
    try {
      if (localStream.current) {
        const audioTracks = localStream.current.getAudioTracks();
        
        if (!enabled) {
          // Disable and stop existing tracks
          audioTracks.forEach(track => {
            track.enabled = false;
            track.stop();
          });
        } else {
          // Remove any stopped tracks
          audioTracks.forEach(track => {
            localStream.current.removeTrack(track);
            const sender = peerConnection.current?.getSenders()
              .find(s => s.track?.kind === 'audio');
            if (sender) {
              peerConnection.current.removeTrack(sender);
            }
          });

          // Add new audio track
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: MEDIA_CONSTRAINTS.audio,
            video: false
          });
          
          const audioTrack = audioStream.getAudioTracks()[0];
          localStream.current.addTrack(audioTrack);

          if (peerConnection.current) {
            peerConnection.current.addTrack(audioTrack, localStream.current);
          }
        }
      }
    } catch (err) {
      console.error("Toggle audio failed:", err);
    }
  }, []);

  const toggleVideo = useCallback(async (enabled) => {
    try {
      if (localStream.current) {
        const videoTracks = localStream.current.getVideoTracks();
        
        if (!enabled) {
          // Disable and stop existing tracks
          videoTracks.forEach(track => {
            track.enabled = false;
            track.stop();
          });
        } else {
          // Remove any stopped tracks
          videoTracks.forEach(track => {
            localStream.current.removeTrack(track);
            const sender = peerConnection.current?.getSenders()
              .find(s => s.track?.kind === 'video');
            if (sender) {
              peerConnection.current.removeTrack(sender);
            }
          });

          // Add new video track
          const videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: MEDIA_CONSTRAINTS.video
          });
          
          const videoTrack = videoStream.getVideoTracks()[0];
          localStream.current.addTrack(videoTrack);

          if (peerConnection.current) {
            peerConnection.current.addTrack(videoTrack, localStream.current);
          }

          // Update local video display
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream.current;
          }
        }
      }
    } catch (err) {
      console.error("Toggle video failed:", err);
    }
  }, []);



  // Handle signaling
  const createAndSendOffer = useCallback(async () => {
    try {
      if (!peerConnection.current) return;

      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } catch (err) {
      console.error("Error creating offer:", err);
    }
  }, [roomId]);

  // Handle reconnection
  const handleReconnection = useCallback(async () => {
    try {
      cleanup();
      await initializePeerConnection();
      if (isInitiator.current) {
        await createAndSendOffer();
      }
    } catch (err) {
      console.error("Reconnection failed:", err);
    }
  }, [cleanup, initializePeerConnection, createAndSendOffer]);

  // Setup socket event listeners
  useEffect(() => {
    socket.on("user-joined", () => {
      isInitiator.current = true;
      createAndSendOffer();
    });

    socket.on("offer", async (offer) => {
      try {
        if (!peerConnection.current) return;
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer", { roomId, answer });
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.on("answer", async (answer) => {
      try {
        if (!peerConnection.current) return;
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        if (!peerConnection.current) return;
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      cleanup();
    };
  }, [roomId, cleanup, createAndSendOffer]);

  return {
    localVideoRef,
    remoteVideoRef,
    initializeMediaStream,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
};
