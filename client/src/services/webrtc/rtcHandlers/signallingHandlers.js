import { socket } from "../../socket";

export const handleUserJoined = (isInitiator, createAndSendOffer) => {
  console.log("User joined room creating offer");
  isInitiator.current = true;
  createAndSendOffer();
};

export const handleOffer = async (offer, peerConnection, initializePeerConnection, roomId) => {
  try {
    if (!peerConnection.current) {
      await initializePeerConnection();
    }

    // Check signaling state
    if (peerConnection.current.signalingState !== "stable") {
      console.log("Ignoring offer - signaling state not stable");
      return;
    }

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    console.error("Error handling offer:", err);
  }
};

export const handleAnswer = async (answer, peerConnection) => {
  try {
    if (!peerConnection.current) {
      console.warn("No peer connection available");
      return;
    }

    console.log("Setting remote description from answer");
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error("Error handling answer:", err);
  }
};

export const createAndSendOffer = async (peerConnection, roomId) => {
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
};

export const handleIceCandidateEvent = (candidate, roomId) => {
  if (!candidate) return;

  console.log("Sending ICE candidate:", {
    sdpMLineIndex: candidate.sdpMLineIndex,
    sdpMid: candidate.sdpMid,
    candidate: candidate.candidate,
    usernameFragment: candidate.usernameFragment,
  });

  socket.emit("ice-candidate", {
    roomId,
    candidate: {
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
      candidate: candidate.candidate,
      usernameFragment: candidate.usernameFragment,
    },
  });
};

export const handleIceCandidate = async (data, peerConnection) => {
  try {
    if (!peerConnection.current?.remoteDescription) {
      console.warn("No remote description set - buffering ICE candidate");
      return;
    }

    if (!data?.candidate?.candidate) {
      console.warn("Invalid ICE candidate");
      return;
    }

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
};