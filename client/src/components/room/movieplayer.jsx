// src/components/room/movieplayer.jsx
import PropTypes from "prop-types";
import { forwardRef, useImperativeHandle, useEffect, useState, useRef } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";

const MoviePlayer = forwardRef(
  (
    {
      roomId,
      isPlaying,
      onPlayingChange,
      onProgressChange,
    },
    ref
  ) => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    }, [isPlaying]);

    // Expose methods with error handling
    useImperativeHandle(ref, () => ({
      handlePlaybackToggle: () => {
        try {
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
            onPlayingChange?.(!videoRef.current.paused);
          }
        } catch (err) {
          console.error("Playback toggle failed:", err);
          setError("Failed to toggle playback");
        }
      },
      handleSeek: (time) => {
        try {
          if (videoRef.current) {
            const duration = videoRef.current.duration;
            videoRef.current.currentTime = (time / 100) * duration;
          }
        } catch (err) {
          console.error("Seek failed:", err);
          setError("Failed to seek video");
        }
      },
      handleFileUpload: async (file) => {
        try {
          const url = URL.createObjectURL(file);
          videoRef.current.src = url;
        } catch (err) {
          console.error("File upload failed:", err);
          setError("Failed to upload video file");
        }
      },
      handleFastForward: () => {
        try {
          if (!videoRef.current) return;
          const newTime = Math.min(
            videoRef.current.currentTime + 10,
            videoRef.current.duration
          );
          videoRef.current.currentTime = newTime;
        } catch (err) {
          console.error("Fast forward failed:", err);
          setError("Failed to fast forward");
        }
      },
      handleRewind: () => {
        try {
          if (!videoRef.current) return;
          const newTime = Math.max(videoRef.current.currentTime - 10, 0);
          videoRef.current.currentTime = newTime;
        } catch (err) {
          console.error("Rewind failed:", err);
          setError("Failed to rewind");
        }
      },
    }));

    const handleTimeUpdate = () => {
      if (!videoRef.current?.duration) return;
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(currentProgress);
      onProgressChange?.(currentProgress);
    };

    const handleLoadedMetadata = () => {
      if (!videoRef.current) return;
      onProgressChange?.(0);
    };

    const handleVideoError = (e) => {
      const error = e.target.error;
      switch (error?.code) {
        case 1:
          setError("Video playback aborted");
          break;
        case 2:
          setError("Network error while loading video");
          break;
        case 3:
          setError("Video decoding error");
          break;
        case 4:
          setError("Video format not supported");
          break;
        default:
          setError("An error occurred while playing video");
      }
    };

    useEffect(() => {
      if (error) {
        const timer = setTimeout(() => {
          setError(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }, [error]);

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

        {error && (
          <Alert
            severity="error"
            sx={{ position: "absolute", top: 16, right: 16 }}
            onClose={() => setError(null)}
          >
            {error}
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
  isPlaying: PropTypes.bool,
  onPlayingChange: PropTypes.func,
  onProgressChange: PropTypes.func,
};

MoviePlayer.displayName = "MoviePlayer";

export default MoviePlayer;