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
        // Enable/disable at hardware level
        track.enabled = enabled;
        
        // Optional: Fully stop track when disabled for complete hardware shutdown
        if (!enabled) {
          track.stop();
        }
      });
    }
  },

  toggleVideoTrack(stream, enabled) {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        // Enable/disable at hardware level
        track.enabled = enabled;
        
        // Optional: Fully stop track when disabled for complete hardware shutdown
        if (!enabled) {
          track.stop();
        }
      });
    }
  },
    // Add method to reinitialize specific track
    async reinitializeTrack(type) {
      try {
        const constraints = {
          audio: type === 'audio',
          video: type === 'video'
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return {
          stream,
          error: null
        };
      } catch (err) {
        console.error(`Failed to reinitialize ${type} track:`, err);
        return {
          stream: null,
          error: `Failed to reinitialize ${type} device`
        };
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