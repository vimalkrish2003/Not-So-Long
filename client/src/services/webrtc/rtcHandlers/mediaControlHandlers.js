import { MEDIA_CONSTRAINTS } from "../rtcConfig";

export const toggleAudio = async (
  localStream,
  peerConnection,
  isAudioAvailable,
  setIsAudioAvailable,
  enabled
) => {
  try {
    if (!localStream.current) return false;
    if (!isAudioAvailable) {
      console.warn("No audio device available");
      return false;
    }

    const audioTracks = localStream.current.getAudioTracks();

    // Case 1: No tracks and trying to enable -> Create new track
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
        return false;
      }
    } 
    // Case 2: Has tracks and trying to disable -> Stop and remove tracks
    else if (!enabled) {
      audioTracks.forEach((track) => {
        track.enabled = false;
        track.stop();
        const sender = peerConnection.current?.getSenders()
          .find(s => s.track === track);
        if (sender) {
          peerConnection.current.removeTrack(sender);
        }
        localStream.current.removeTrack(track);
      });
    } 
    // Case 3: Has tracks and trying to enable -> Create new track
    else if (enabled) {
      try {
        // Remove old tracks first
        audioTracks.forEach((track) => {
          track.stop();
          localStream.current.removeTrack(track);
          const sender = peerConnection.current?.getSenders()
            .find(s => s.track === track);
          if (sender) {
            peerConnection.current.removeTrack(sender);
          }
        });

        // Create new track
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
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Toggle audio failed:", err);
    return false;
  }
};


export const toggleVideo = async (
  localStream,
  peerConnection,
  localVideoRef,
  enabled
) => {
  try {
    if (!localStream.current) return false;

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
    return true; // Indicate successful toggle
  } catch (err) {
    console.error("Toggle video failed:", err);
    return false; // Indicate failed toggle
  }
};