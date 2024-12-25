import { socket } from "../../../services/socket";
import { RECONNECTION_CONFIG } from "../rtcConfig";

export const monitorConnectionState = (peerConnection, setConnectionState,handlers) => {
  if (!peerConnection.current) return;

  peerConnection.current.onconnectionstatechange = () => {
    console.log("Connection State:", peerConnection.current.connectionState);
    console.log("ICE Connection State:", peerConnection.current.iceConnectionState);
    console.log("Signaling State:", peerConnection.current.signalingState);
    
    setConnectionState(peerConnection.current.connectionState);
    
    // Add reconnection handling here
    if (peerConnection.current.connectionState === "failed") {
      const { cleanup, initializePeerConnection, createAndSendOffer, isInitiator } = handlers;
      handleReconnection(
        cleanup,
        initializePeerConnection,
        createAndSendOffer,
        isInitiator
      );
    }
  };
};

export const cleanupConnections = ({
  localStream,
  peerConnection,
  remoteStream,
  localVideoRef,
  remoteVideoRef
}, socket) => {
  // Remove socket listeners if socket exists
  if (socket) {
    socket.off("user-joined");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
  }

  // Cleanup local stream
  if (localStream?.current) {
    localStream.current.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    localStream.current = null;
  }

  // Cleanup peer connection
  if (peerConnection?.current) {
    // Remove all senders
    const senders = peerConnection.current.getSenders();
    senders.forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
      try {
        peerConnection.current.removeTrack(sender);
      } catch (err) {
        console.warn('Error removing track:', err);
      }
    });
    peerConnection.current.close();
    peerConnection.current = null;
  }

  // Cleanup remote stream
  if (remoteStream?.current) {
    remoteStream.current.getTracks().forEach((track) => {
      track.stop();
      track.enabled = false;
    });
    remoteStream.current = null;
  }

  // Clear video elements
  if (localVideoRef?.current) {
    localVideoRef.current.srcObject = null;
  }
  if (remoteVideoRef?.current) {
    remoteVideoRef.current.srcObject = null;
  }
};


export const handleReconnection = async (
  cleanup,
  initializePeerConnection,
  createAndSendOffer,
  isInitiator,
) => {
  let attempts=0;
  const tryReconnect = async () => {
    try {
      if (attempts >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
        throw new Error("Max reconnection attempts reached");
      }

      console.log(`Reconnection attempt ${attempts + 1}/${RECONNECTION_CONFIG.MAX_ATTEMPTS}`);

      await cleanup();
      const pc = await initializePeerConnection();

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          console.log("Reconnection successful");
        } else if (pc.connectionState === "failed") {
          attempts++;
          setTimeout(tryReconnect, RECONNECTION_CONFIG.DELAY * attempts);
        }
      };

      if (isInitiator.current) {
        await createAndSendOffer();
      }
    } catch (err) {
      console.error("Reconnection failed:", err);
      attempts++;
      if (attempts < RECONNECTION_CONFIG.MAX_ATTEMPTS) {
        setTimeout(tryReconnect, RECONNECTION_CONFIG.DELAY * attempts);
      }
    }
  };

  await tryReconnect();
};