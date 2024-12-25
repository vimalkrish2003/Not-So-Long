// services/webrtc.js
import { useRef, useCallback, useEffect, useState } from "react";
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
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
};

const MAX_RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_DELAY = 1000;

// WebRTC Hook
export const useWebRTC = ({ roomId }) => {
  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(new MediaStream());
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isInitiator = useRef(false);
  const [connectionState, setConnectionState] = useState("new");
  const [isAudioAvailable, setIsAudioAvailable] = useState(false);
  const [isVideoAvailable, setIsVideoAvailable] = useState(false);





  // Initialize peer connection
  const initializePeerConnection = useCallback(async () => {
    try {
      peerConnection.current = new RTCPeerConnection(RTC_CONFIG);
      monitorConnectionState();
      // Add local tracks to peer connection
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, localStream.current);
        });
      }

      // Handle remote tracks
      peerConnection.current.ontrack = ({ track, streams }) => {
        console.log("Received remote track:", track.kind);
        
        // Create new MediaStream if null
        if (!remoteStream.current) {
          remoteStream.current = new MediaStream();
        }
      
        // Safety check for stream validity
        try {
          // Add track to remote stream
          if (!remoteStream.current.getTracks().includes(track)) {
            remoteStream.current.addTrack(track);
          }
      
          // Add unmute listener
          track.addEventListener("unmute", () => {
            console.log("Track unmuted:", track.kind);
          });
      
          // Update remote video element
          if (remoteVideoRef.current) {
            // Use the first stream from incoming streams array if available
            if (streams && streams[0]) {
              remoteVideoRef.current.srcObject = streams[0];
            } else {
              remoteVideoRef.current.srcObject = remoteStream.current;
            }
          }
        } catch (err) {
          console.error("Error handling remote track:", err);
        }
      };

      // ICE candidate handling
      // In initializePeerConnection()
      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate) {
          const candidateData = {
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdpMid: candidate.sdpMid,
            candidate: candidate.candidate,
            usernameFragment: candidate.usernameFragment,
          };

          // Log candidate for debugging
          console.log("Sending ICE candidate:", candidateData);

          socket.emit("ice-candidate", {
            roomId,
            candidate: candidateData,
          });
        }
      };

      // Connection state monitoring
      peerConnection.current.onconnectionstatechange = () => {
        console.log(
          "ICE Connection State:",
          peerConnection.current.iceConnectionState
        );
        console.log(
          "Connection State:",
          peerConnection.current.connectionState
        );
        console.log("Signaling State:", peerConnection.current.signalingState);
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

  // Initialize media devices and stream
  const initializeMediaStream = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some((device) => device.kind === "audioinput");
      const hasVideo = devices.some((device) => device.kind === "videoinput");

      setIsAudioAvailable(hasAudio);
      setIsVideoAvailable(hasVideo);

      const constraints = {
        audio: hasAudio ? MEDIA_CONSTRAINTS.audio : false,
        video: hasVideo ? MEDIA_CONSTRAINTS.video : false,
      };

      // Get new stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.current = stream;

      // Set local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize peer connection first
      if (!peerConnection.current) {
        await initializePeerConnection();
      }

      // Clear existing senders before adding new tracks
      const senders = peerConnection.current.getSenders();
      senders.forEach((sender) => {
        peerConnection.current.removeTrack(sender);
      });

      // Add new tracks
      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      return stream;
    } catch (err) {
      console.error("Media stream error:", err);
      throw err;
    }
  }, [initializePeerConnection]);


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

  // Monitor connection state

  const monitorConnectionState = useCallback(() => {
    if (!peerConnection.current) return;

    peerConnection.current.onconnectionstatechange = () => {
      const state = peerConnection.current.connectionState;
      setConnectionState(state);
    };
  }, []);

  // Handle media controls
  const toggleAudio = useCallback(
    async (enabled) => {
      try {
        if (!localStream.current) return;
        if (!isAudioAvailable) {
          console.warn("No audio device available");
          return false; // Return false to indicate toggle failed
        }

        const audioTracks = localStream.current.getAudioTracks();

        // If no audio tracks and trying to enable
        if (audioTracks.length === 0 && enabled) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: MEDIA_CONSTRAINTS.audio,
              video: false,
            });
            const newTrack = audioStream.getAudioTracks()[0];
            localStream.current.addTrack(newTrack);
            if (peerConnection.current) {
              peerConnection.current.addTrack(newTrack, localStream.current);
            }
          } catch (deviceErr) {
            console.warn("Failed to get audio device");
            setIsAudioAvailable(false);
            return false; // Return false to indicate toggle failed
          }
        } else {
          audioTracks.forEach((track) => {
            track.enabled = enabled;
          });
        }
        return true; // Return true to indicate successful toggle
      } catch (err) {
        console.error("Toggle audio failed:", err);
        return false;
      }
    },
    [isAudioAvailable]
  );

  const toggleVideo = useCallback(async (enabled) => {
    try {
      if (!localStream.current) return;

      const videoTracks = localStream.current.getVideoTracks();

      if (!enabled) {
        // Disable existing tracks
        videoTracks.forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      } else {
        // Remove old tracks first
        videoTracks.forEach((track) => {
          track.stop();
          const sender = peerConnection.current
            ?.getSenders()
            .find((s) => s.track === track);
          if (sender) {
            peerConnection.current.removeTrack(sender);
          }
          localStream.current.removeTrack(track);
        });

        // Get fresh video track
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: MEDIA_CONSTRAINTS.video,
        });

        const newTrack = videoStream.getVideoTracks()[0];
        newTrack.enabled = true;

        // Add to local stream
        localStream.current.addTrack(newTrack);

        // Add to peer connection
        if (peerConnection.current) {
          peerConnection.current.addTrack(newTrack, localStream.current);
        }

        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream.current;
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
    let attempts = 0;

    const tryReconnect = async () => {
      try {
        if (attempts >= MAX_RECONNECTION_ATTEMPTS) {
          throw new Error("Max reconnection attempts reached");
        }

        console.log(
          `Reconnection attempt ${attempts + 1}/${MAX_RECONNECTION_ATTEMPTS}`
        );

        await cleanup();
        const pc = await initializePeerConnection();

        // Monitor new connection state
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            console.log("Reconnection successful");
          } else if (pc.connectionState === "failed") {
            attempts++;
            setTimeout(tryReconnect, RECONNECTION_DELAY * attempts);
          }
        };

        if (isInitiator.current) {
          await createAndSendOffer();
        }
      } catch (err) {
        console.error("Reconnection failed:", err);
        attempts++;
        if (attempts < MAX_RECONNECTION_ATTEMPTS) {
          setTimeout(tryReconnect, RECONNECTION_DELAY * attempts);
        }
      }
    };

    await tryReconnect();
  }, [cleanup, initializePeerConnection, createAndSendOffer]);

  // Setup socket event listeners
  useEffect(() => {
    socket.on("user-joined", () => {
      console.log("User joined room creating offer");
      isInitiator.current = true;
      createAndSendOffer();
    });

    socket.on("offer", async (offer) => {
      try {
        if (!peerConnection.current) {
          await initializePeerConnection();
        }

        // Check signaling state
        if (peerConnection.current.signalingState !== "stable") {
          console.log("Ignoring offer - signaling state not stable");
          return;
        }

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
      console.log("Received answer from peer,setting remote description");
      try {
        if (!peerConnection.current) {
          console.warn("No peer connection available");
          return;
        }

        if (peerConnection.current.signalingState === "stable") {
          console.warn("Ignoring answer in stable state");
          return;
        }

        console.log("Received answer from peer");
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });
    socket.on("ice-candidate", async (data) => {
      try {
        if (!peerConnection.current) {
          console.warn("No peer connection available");
          return;
        }

        // Validate candidate data
        if (!data?.candidate?.candidate) {
          console.warn("Received invalid ICE candidate:", data);
          return;
        }

        console.log("Received ICE candidate:", data.candidate);

        const candidate = new RTCIceCandidate({
          candidate: data.candidate.candidate,
          sdpMLineIndex: data.candidate.sdpMLineIndex,
          sdpMid: data.candidate.sdpMid,
          usernameFragment: data.candidate.usernameFragment,
        });

        await peerConnection.current.addIceCandidate(candidate);
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    const cleanup = () => {
      // Remove socket listeners
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
  
      // Cleanup local stream
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        localStream.current = null;
      }
  
      // Cleanup peer connection
      if (peerConnection.current) {
        // Stop all senders
        peerConnection.current.getSenders().forEach(sender => {
          if (sender.track) {
            sender.track.stop();
            sender.track.enabled = false;
          }
        });
        peerConnection.current.close();
        peerConnection.current = null;
      }
  
      // Cleanup remote stream
      if (remoteStream.current) {
        remoteStream.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        remoteStream.current = null;
      }
  
      // Clear video elements
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  
    // 3. Return cleanup function
    return cleanup;
    
  }, [roomId, initializePeerConnection]);

  return {
    localVideoRef,
    remoteVideoRef,
    initializeMediaStream,
    toggleAudio,
    toggleVideo,
    cleanup,
    connectionState,
    isAudioAvailable,
  };
};
