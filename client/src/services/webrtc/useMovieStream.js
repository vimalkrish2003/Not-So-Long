// src/services/webrtc/useMovieStream.js
import { useRef, useState, useCallback, useEffect } from "react";

const CONTROL_CHANNEL_CONFIG = {
  ordered: true,
  maxRetransmits: 3,
  maxPacketLifeTime: 3000,
};

const BUFFER_CONFIG = {
  CHUNK_SIZE: 16384, // 16KB chunks
  MAX_QUEUE_SIZE: 100,
};

const VIDEO_CONSTRAINTS = {
  maxFileSize: 3 * 1024 * 1024 * 1024, // 3GB
  allowedTypes: [
    { mime: 'video/mp4', codec: 'avc1.42E01E,mp4a.40.2' },
    { mime: 'video/quicktime', codec: 'avc1.42E01E,mp4a.40.2' },
    { mime: 'video/webm', codec: 'vp8,opus' },
    { mime: 'video/x-matroska', codec: 'vp8,opus' },
    // Add more common video containers
    { mime: 'video/x-m4v', codec: 'avc1.42E01E,mp4a.40.2' },
    { mime: 'video/3gpp', codec: 'mp4v.20.8,mp4a.40.2' }
  ]
};

export const useMovieStream = ({ roomId, peerConnection }) => {
  const videoRef = useRef(null);
  const controlChannelRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const chunksQueueRef = useRef([]);
  const processingChunkRef = useRef(false);
  const networkQualityRef = useRef("high");

  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const detectVideoFormat = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arr = new Uint8Array(reader.result).subarray(0, 12); // Increased to 12 bytes
        let header = "";
        for (let i = 0; i < arr.length; i++) {
          header += arr[i].toString(16).padStart(2, '0'); // Pad with zeros
        }
  
        // Enhanced magic number detection
        const format = (() => {
          // MP4 formats (ftyp...)
          if (header.includes('66747970')) return 'video/mp4';
          
          // QuickTime formats
          if (header.includes('0000001c') || 
              header.includes('6674797071742020') ||
              header.startsWith('0000')) return 'video/quicktime';
          
          // WebM format
          if (header.includes('1a45dfa3')) return 'video/webm';
          
          // Matroska format
          if (header.includes('1f45dfa3')) return 'video/x-matroska';
          
          // Try fallback to file type
          if (file.type.startsWith('video/')) {
            return file.type;
          }
          
          return null;
        })();
  
        console.log('Detected format:', format, 'Header:', header); // Debug info
        resolve(format);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(0, 12));
    });
  }, []);


  // File validation
  const validateVideoFile = useCallback(async (file) => {
    if (!file) throw new Error("No file selected");
  
    if (file.size > VIDEO_CONSTRAINTS.maxFileSize) {
      throw new Error("File too large (max 3GB)");
    }
  
    // Get format from both magic numbers and MIME type
    const detectedFormat = await detectVideoFormat(file);
    const declaredFormat = file.type;
  
    console.log('File validation:', { 
      detectedFormat, 
      declaredFormat, 
      size: file.size 
    }); // Debug info
  
    if (!detectedFormat && !declaredFormat.startsWith('video/')) {
      throw new Error("Unrecognized video format");
    }
  
    // Use either detected or declared format
    const format = detectedFormat || declaredFormat;
    
    // Find matching format in supported types
    const supportedFormat = VIDEO_CONSTRAINTS.allowedTypes.find(
      type => type.mime === format || format.startsWith(type.mime)
    );
  
    if (!supportedFormat) {
      throw new Error(`Unsupported video format: ${format}`);
    }
  
    // Test browser support
    const testSupport = document.createElement('video')
      .canPlayType(`${supportedFormat.mime}; codecs="${supportedFormat.codec}"`);
  
    if (testSupport === '') {
      throw new Error(`Browser does not support format: ${format}`);
    }
  
    return { 
      format: supportedFormat.mime, 
      codec: supportedFormat.codec 
    };
  }, [detectVideoFormat]);

  // Initialize MediaSource
  const initMediaSource = useCallback(() => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    videoRef.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener("sourceopen", () => {
      try {
        sourceBufferRef.current = mediaSource.addSourceBuffer(
          'video/mp4; codecs="avc1.42E01E,mp4a.40.2"'
        );
      } catch (err) {
        console.error("Error creating source buffer:", err);
        setError("Failed to initialize video streaming");
      }
    });
  }, []);

  const handleVideoError = useCallback((e) => {
    const error = e.target?.error;
    let errorMessage = "Failed to load video";

    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video loading aborted";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "Network error while loading video";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = `Video decoding error: ${error.message}`;
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = `Video format not supported: ${error.message}`;
          break;
        default:
          errorMessage = `Video error: ${error.message}`;
      }
    }

    setError(errorMessage);
    setIsLoading(false);
    return errorMessage;
  }, []);

  // Handle file upload with streaming
  const handleFileUpload = useCallback(async (file) => {
  try {
    // First check if control channel is ready
    if (!controlChannelRef.current || controlChannelRef.current.readyState !== "open") {
      throw new Error("Control channel not ready. Please try again in a few seconds.");
    }

    const { format, codec } = await validateVideoFile(file);
    setIsLoading(true);
    setError(null);
    setIsHost(true);
    setProgress(0);

    // Create blob URL with proper type
    const videoUrl = URL.createObjectURL(
      new Blob([file], { type: format })
    );

    if (videoRef.current) {
      // Cleanup existing video
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src);
      }

      return new Promise((resolve, reject) => {
        const loadVideo = () => {
          videoRef.current.onloadedmetadata = () => {
            setDuration(videoRef.current.duration);
            setIsLoading(false);

            // Send video info through control channel
            try {
              controlChannelRef.current.send(
                JSON.stringify({
                  type: "videoInfo",
                  data: {
                    duration: videoRef.current.duration,
                    format,
                    codec,
                    videoUrl
                  }
                })
              );
              resolve();
            } catch (err) {
              reject(new Error("Failed to send video info to peer"));
            }
          };

          videoRef.current.onerror = (e) => {
            const errorMsg = handleVideoError(e);
            reject(new Error(errorMsg));
          };

          videoRef.current.src = videoUrl;
        };

        if (videoRef.current.readyState === 0) {
          videoRef.current.addEventListener("loadeddata", loadVideo, { once: true });
        } else {
          loadVideo();
        }
      });
    }
  } catch (err) {
    console.error("File upload error:", err);
    setError(err.message || "Failed to process video file");
    setIsLoading(false);
    throw err;
  }
}, [validateVideoFile, handleVideoError]);

  // Initialize control channel
  const initializeControlChannel = useCallback(() => {
    if (!peerConnection) return;

    try {
      const channel = peerConnection.createDataChannel("movieControl", {
        ordered: true,
        maxRetransmits: 3,
      });

      channel.onopen = () => {
        console.log("Movie control channel opened");
      };

      channel.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);

        switch (type) {
          case "videoInfo":
            // Handle video info from host
            if (!isHost && videoRef.current) {
              videoRef.current.src = data.videoUrl;
            }
            break;
          case "playback":
            if (!isHost && videoRef.current) {
              data.isPlaying
                ? videoRef.current.play()
                : videoRef.current.pause();
            }
            break;
          case "seek":
            if (!isHost && videoRef.current) {
              videoRef.current.currentTime = data.time;
            }
            break;
        }
      };

      controlChannelRef.current = channel;
    } catch (err) {
      console.error("Failed to create control channel:", err);
      setError("Failed to initialize movie controls");
    }
  }, [peerConnection, isHost]);

  // Handle movie state sync
  const handleMovieState = useCallback(({ currentTime, isPlaying }) => {
    if (!videoRef.current) return;

    const timeDiff = Math.abs(videoRef.current.currentTime - currentTime);
    if (timeDiff > 1) {
      videoRef.current.currentTime = currentTime;
    }

    if (isPlaying !== !videoRef.current.paused) {
      isPlaying ? videoRef.current.play() : videoRef.current.pause();
    }
  }, []);

  // Handle seek control
  const handleMovieSeek = useCallback(({ time }) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
  }, []);

  // Handle playback control
  const handlePlaybackControl = useCallback(({ isPlaying }) => {
    if (!videoRef.current) return;
    isPlaying ? videoRef.current.play() : videoRef.current.pause();
  }, []);

  // Send control message through data channel
  const sendControlMessage = useCallback((type, data) => {
    if (
      !controlChannelRef.current ||
      controlChannelRef.current.readyState !== "open"
    ) {
      console.warn("Control channel not ready");
      return;
    }

    try {
      controlChannelRef.current.send(JSON.stringify({ type, data }));
    } catch (err) {
      console.error("Failed to send control message:", err);
    }
  }, []);

  // Exposed control methods
  const handlePlaybackToggle = useCallback(() => {
    if (!videoRef.current) return;

    const isPlaying = videoRef.current.paused;
    if (isPlaying) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }

    if (isHost) {
      sendControlMessage("playback", { isPlaying });
    }
  }, [isHost, sendControlMessage]);

  const handleSeek = useCallback(
    (time) => {
      if (!videoRef.current) return;
      videoRef.current.currentTime = time;

      if (isHost) {
        sendControlMessage("seek", { time });
      }
    },
    [isHost, sendControlMessage]
  );

  // Cleanup
  const cleanup = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeEventListener("loadedmetadata", null);
      videoRef.current.removeEventListener("error", null);
      videoRef.current.removeEventListener("timeupdate", null);
      if (videoRef.current.src) {
        URL.revokeObjectURL(videoRef.current.src);
        videoRef.current.src = "";
        videoRef.current.load(); // Force cleanup
      }
    }

    if (controlChannelRef.current) {
      controlChannelRef.current.close();
      controlChannelRef.current = null;
    }

    setProgress(0);
    setDuration(0);
    setError(null);
    setIsLoading(false);
  }, []);

  // Initialize channels when component mounts
  useEffect(() => {
    if (peerConnection) {
      initializeControlChannel();
    }
    return cleanup;
  }, [peerConnection, initializeControlChannel, cleanup]);

  return {
    videoRef,
    isHost,
    isLoading,
    error,
    duration,
    progress,
    handlePlaybackToggle,
    handleSeek,
    handleFileUpload,
    cleanup,
  };
};
