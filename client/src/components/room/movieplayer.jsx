// src/components/room/movieplayer.jsx
import PropTypes from "prop-types";
import { forwardRef, useImperativeHandle, useEffect, useState } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import { useMovieStream } from "../../services/webrtc/useMovieStream";

const MoviePlayer = forwardRef(
  (
    {
      roomId,
      peerConnection,
      isPlaying,
      onPlayingChange,
      onProgressChange, // This is used for progress updates
    },
    ref
  ) => {
    const {
      videoRef,
      isHost,
      isLoading,
      error: streamError,
      progress,
      handlePlaybackToggle,
      handleSeek,
      handleFileUpload,
      cleanup,
    } = useMovieStream({ roomId, peerConnection });

    const [componentError, setComponentError] = useState(null);

    useEffect(() => {
      // Update parent component with progress
      onProgressChange?.(progress);
    }, [progress, onProgressChange]);

    // Add time update handler

    const handleTimeUpdate = () => {
      if (!videoRef.current?.duration) return;

      const progress =
        (videoRef.current.currentTime / videoRef.current.duration) * 100;
      if (Number.isFinite(progress)) {
        onProgressChange?.(progress);
      }
    };

    // Add metadata loaded handler
    const handleLoadedMetadata = () => {
      if (!videoRef.current) return;
      // Update progress instead of duration
      if (onProgressChange && videoRef.current.duration) {
        onProgressChange(0); // Initialize progress at 0
      }
    };

    // Expose methods with error handling
    useImperativeHandle(ref, () => ({
      handlePlaybackToggle: () => {
        try {
          handlePlaybackToggle();
          onPlayingChange?.(!isPlaying);
        } catch (err) {
          console.error("Playback toggle failed:", err);
          setComponentError("Failed to toggle playback");
        }
      },
      handleSeek: (time) => {
        try {
          handleSeek(time);
        } catch (err) {
          console.error("Seek failed:", err);
          setComponentError("Failed to seek video");
        }
      },
      handleFileUpload: async (file) => {
        try {
          await handleFileUpload(file);
        } catch (err) {
          console.error("File upload failed:", err);
          setComponentError("Failed to upload video file");
        }
      },
      handleFastForward: () => {
        try {
          if (!videoRef.current) return;
          const newTime = Math.min(
            videoRef.current.currentTime + 10,
            videoRef.current.duration
          );
          handleSeek(newTime);
        } catch (err) {
          console.error("Fast forward failed:", err);
          setComponentError("Failed to fast forward");
        }
      },
      handleRewind: () => {
        try {
          if (!videoRef.current) return;
          const newTime = Math.max(videoRef.current.currentTime - 10, 0);
          handleSeek(newTime);
        } catch (err) {
          console.error("Rewind failed:", err);
          setComponentError("Failed to rewind");
        }
      },
    }));

    const handleVideoError = (e) => {
      const error = e.target.error;
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          setComponentError("Video playback aborted");
          break;
        case error.MEDIA_ERR_NETWORK:
          setComponentError("Network error while loading video");
          break;
        case error.MEDIA_ERR_DECODE:
          setComponentError("Video decoding error");
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          setComponentError("Video format not supported");
          break;
        default:
          setComponentError("An error occurred while playing video");
      }
    };

    // Clear error after 5 seconds
    useEffect(() => {
      if (componentError) {
        const timer = setTimeout(() => {
          setComponentError(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }, [componentError]);

    // Cleanup on unmount
    useEffect(() => cleanup, [cleanup]);

    return (
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          bgcolor: "#000",
        }}
      >
        {isLoading && (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {(componentError || streamError) && (
          <Alert
            severity="error"
            sx={{ position: "absolute", top: 16, right: 16 }}
            onClose={() => setComponentError(null)}
          >
            {componentError || streamError}
          </Alert>
        )}

        <video
          ref={videoRef}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
          playsInline
          aria-label="Movie player"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
        />
      </Box>
    );
  }
);

MoviePlayer.propTypes = {
  roomId: PropTypes.string.isRequired,
  peerConnection: PropTypes.object,
  isPlaying: PropTypes.bool,
  onPlayingChange: PropTypes.func,
  onProgressChange: PropTypes.func,
};

export default MoviePlayer;
