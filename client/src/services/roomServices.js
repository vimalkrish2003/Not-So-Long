import { socket } from "./socket";

const roomServices = {
  // Get user media stream
  async initializeUserMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      return {
        stream,
        error: null
      };
    } catch (err) {
      console.error("Media initialization error:", err);
      
      // Handle common media errors
      let errorMessage = "Failed to access media devices";
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera/Microphone access denied";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera/microphone found";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Media device already in use";
      }

      return {
        stream: null,
        error: errorMessage
      };
    }
  },

  // Control media tracks
  toggleAudioTrack(stream, enabled) {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  },

  toggleVideoTrack(stream, enabled) {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  },

  // Cleanup media stream
  stopMediaStream(stream) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
};

export default roomServices;