// movieplayer.jsx
import PropTypes from "prop-types";
import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { movieServices } from "../../services/movieServices";
import { useBufferManager } from "../hooks/useBufferManager";
import { usePeer } from "../../contexts/peerContext";
import {
  MovieMessageTypes,
  ControlMessageTypes,
} from "../../configs/peerConfig";
import { Box, CircularProgress, Alert } from "@mui/material";

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

const useMovieOperations = (bufferManager, peerContext) => {
  // Buffer operations facade
  const bufferOperations = useMemo(
    () => ({
      addChunk: bufferManager.operations.addChunk,
      removeChunk: bufferManager.operations.removeChunk,
      initialize: bufferManager.initialize,
      controlPlayback: bufferManager.controlPlayback,
      bufferHealth: bufferManager.bufferHealth,
    }),
    [bufferManager.operations]
  );

  // Peer operations facade
  const peerOperations = useMemo(
    () => ({
      send: {
        movie: peerContext.sendMovieData,
        control: peerContext.sendControl,
      },
      register: {
        movie: peerContext.registerMovieHandler,
        control: peerContext.registerControlHandler,
      },
      channels: {
        movie: peerContext.movieChannel,
      },
    }),
    [peerContext]
  );

  return {
    buffer: bufferOperations,
    peer: peerOperations,
  };
};

const MoviePlayer = memo(
  forwardRef(({ roomId, isPlaying, onPlayingChange }, ref) => {
    // Core refs
    const videoRef = useRef(null);
    const mediaSourceRef = useRef(null);
    const sourceBufferRef = useRef(null);
    const fileRef = useRef(null);
    const cleanupRef = useRef(null);
    const streamingCurrentlyRef = useRef(false);

    // Streaming state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isLeader, setIsLeader] = useState(false);

    const { buffer, peer } = useMovieOperations(useBufferManager(), usePeer());

    const handlePlay = useCallback(
      (timestamp) => {
        const timeUntilStart = timestamp - Date.now();

        // Schedule synchronized playback
        if (timeUntilStart > 0) {
          setTimeout(() => {
            if (videoRef.current) {
              try {
                // Start buffer consumption
                buffer.controlPlayback(true);

                // Start video playback
                videoRef.current
                  .play()
                  .then(() => {
                    console.log("Playback started successfully");
                    streamingCurrentlyRef.current = true;
                    onPlayingChange(true);
                  })
                  .catch((err) => {
                    console.error("Playback failed:", err);
                    // Stop buffer consumption if video playback fails
                    buffer.controlPlayback(false);
                    streamingCurrentlyRef.current = false;
                    onPlayingChange(false);
                    setError("Failed to start playback");
                  });
              } catch (e) {
                console.log("Error in starting playback", e);
              }
            }
          }, timeUntilStart);
        }
      },
      [buffer, onPlayingChange]
    );

    // Callbacks defined before buffer manager initialization
    const handleBufferLow = useCallback(
      ({ availableSpace }) => {
        if (!isLeader) {
          peer.send.control(ControlMessageTypes.MOVIE_BUFFER_LOW, {
            availableSpace,
            timestamp: Date.now(),
          });
        }
      },
      [isLeader, peer.send.control]
    );

    const handleReadyForPlayback = useCallback(() => {
      if (!isLeader && !streamingCurrentlyRef.current) {
        const startTime = Date.now() + 1000; // Define startTime here
        peer.send.control(ControlMessageTypes.MOVIE_ISPLAYING, {
          timestamp: startTime,
        });
        handlePlay(startTime); // Pass the same startTime to handlePlay
      }
    }, [isLeader, peer, handlePlay]);

    const bufferManagerOptions = useMemo(
      () => ({
        onBufferLow: handleBufferLow,
        onReadyForPlayback: handleReadyForPlayback,
      }),
      [handleBufferLow, handleReadyForPlayback]
    );

    console.log("MoviePlayer re rendered");

    // Core setup - Initialize MediaSource
    const initializeMediaSource = useCallback(
      async (file) => {
        if (!videoRef.current) throw new Error("No video element");

        try {
          const { mediaSource, sourceBuffer, cleanup } =
            await movieServices.initializeMediaSource(videoRef.current, file);

          mediaSourceRef.current = mediaSource;
          sourceBufferRef.current = sourceBuffer;
          cleanupRef.current = cleanup;

          // Initialize buffer manager with source buffer
          buffer.initialize(sourceBuffer, bufferManagerOptions);

          return sourceBuffer;
        } catch (err) {
          console.error("MediaSource init error:", err);
          throw new Error("Failed to initialize player");
        }
      },
      [buffer, bufferManagerOptions]
    );

    // Handle Sending Chunks - Leader
    const handleChunkSend = useCallback(
      (availableSpace) => {
        if (!isLeader || !fileRef.current || !peer.channels.movie) return;

        try {
          const file = fileRef.current;
          const maxChunks = Math.floor(availableSpace / CHUNK_SIZE);
          let chunksSent = 0;
          let isPaused = false;

          // Track current position in file
          const offset = fileRef.current.streamOffset || 0;

          const readNextChunk = () => {
            if (
              isPaused ||
              chunksSent >= maxChunks ||
              offset + chunksSent * CHUNK_SIZE >= file.size
            ) {
              fileRef.current.streamOffset = offset + chunksSent * CHUNK_SIZE;
              return;
            }

            const chunk = file.slice(
              offset + chunksSent * CHUNK_SIZE,
              offset + chunksSent * CHUNK_SIZE + CHUNK_SIZE
            );
            reader.readAsArrayBuffer(chunk);
          };

          const reader = new FileReader();
          reader.onload = async (e) => {
            let bufferDrainHandler;
            try {
              if (
                peer.channels.movie.bufferedAmount >
                peer.channels.movie.bufferedAmountLowThreshold
              ) {
                isPaused = true;
                await new Promise((resolve) => {
                  bufferDrainHandler = () => {
                    peer.channels.movie.removeEventListener(
                      "bufferedamountlow",
                      bufferDrainHandler
                    );
                    resolve();
                  };
                  peer.channels.movie.addEventListener(
                    "bufferedamountlow",
                    bufferDrainHandler
                  );
                });
                isPaused = false;
              }
              const chunkData = e.target.result;
              // Add to local buffer first
              await buffer.addChunk({
                sequence: fileRef.current.sequence,
                size: chunkData.byteLength,
                data: chunkData,
              });

              const message = movieServices.createChunkMessage(
                fileRef.current.sequence++,
                chunkData,
                offset + chunksSent * CHUNK_SIZE >= file.size
              );

              peer.send.movie(message);
              chunksSent++;
              readNextChunk();
            } catch (err) {
              if (err.message?.includes("send queue is full")) {
                isPaused = true;
                await new Promise((resolve) => {
                  bufferDrainHandler = () => {
                    peer.channels.movie.removeEventListener(
                      "bufferedamountlow",
                      bufferDrainHandler
                    );
                    resolve();
                  };
                  peer.channels.movie.addEventListener(
                    "bufferedamountlow",
                    bufferDrainHandler
                  );
                });
                isPaused = false;
                readNextChunk();
              } else {
                throw err;
              }
            } finally {
              // Cleanup any lingering listeners
              if (bufferDrainHandler) {
                peer.channels.movie.removeEventListener(
                  "bufferedamountlow",
                  bufferDrainHandler
                );
              }
            }
          };

          fileRef.current.sequence = fileRef.current.sequence || 0;
          readNextChunk();
        } catch (err) {
          console.error("Streaming error:", err);
          setError("Failed to stream video");
        }
      },
      [isLeader, peer]
    );

    // Handle incoming chunks - Viewer
    const handleChunkReceived = useCallback(
      async (data) => {
        if (isLeader) return;

        try {
          const chunk = movieServices.parseChunkMessage(data);
          //console.log("Received Chunk", chunk.sequence);
          await buffer.addChunk({
            sequence: chunk.sequence,
            size: chunk.size,
            data: chunk.data,
          });
        } catch (err) {
          console.error("Chunk processing error:", err);
          setError("Failed to process video chunk");
        }
      },
      [isLeader, buffer]
    );

    // Message Handlers
    useEffect(() => {
      // Playback handler for sender
      const handlePlayback = ({ timestamp }) => {
        handlePlay(timestamp);
      };

      // Register playback handler for both leader and viewer
      const playbackCleanup = peer.register.control(
        ControlMessageTypes.MOVIE_ISPLAYING,
        handlePlayback
      );

      if (isLeader) {
        // Leader specific handlers
        const readyCleanup = peer.register.control(
          ControlMessageTypes.MOVIE_READY,
          ({ availableSpace }) => {
            handleChunkSend(availableSpace);
          }
        );

        const bufferLowCleanup = peer.register.control(
          ControlMessageTypes.MOVIE_BUFFER_LOW,
          ({ availableSpace }) => {
            handleChunkSend(availableSpace);
          }
        );

        return () => {
          readyCleanup();
          bufferLowCleanup();
          playbackCleanup();
        };
      } else {
        // Viewer specific handlers
        const chunkCleanup = peer.register.movie(
          MovieMessageTypes.CHUNK,
          handleChunkReceived
        );

        return () => {
          chunkCleanup();
          playbackCleanup();
        };
      }
    }, [
      isLeader,
      peer.register,
      handleChunkSend,
      handleChunkReceived,
      videoRef,
      onPlayingChange,
    ]);

    // File Upload Handler
    useImperativeHandle(ref, () => ({
      handleFileUpload: async (file) => {
        try {
          setIsLoading(true);
          setError(null);

          fileRef.current = file;
          await initializeMediaSource(file);
          setIsLeader(true);

          // Notify peer about movie
          peer.send.control(ControlMessageTypes.MOVIE_ISLOADED, {
            name: file.name,
            type: file.type,
            size: file.size,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error("Upload error:", err);
          setError("Failed to upload video");
          setIsLeader(false);
          fileRef.current = null;
        } finally {
          setIsLoading(false);
        }
      },
    }));

    // Viewer setup handler
    useEffect(() => {
      if (!isLeader) {
        const setupViewer = peer.register.control(
          ControlMessageTypes.MOVIE_ISLOADED,
          async (payload) => {
            try {
              setIsLoading(true);
              const mockFile = new File([], payload.name, {
                type: payload.type,
                lastModified: payload.timestamp,
              });

              await initializeMediaSource(mockFile);

              // Get current available space from buffer health
              const health = buffer.bufferHealth;
              peer.send.control(ControlMessageTypes.MOVIE_READY, {
                availableSpace: health.AvailableSpace,
                timestamp: Date.now(),
              });
            } catch (err) {
              console.error("Viewer setup error:", err);
              setError("Failed to initialize player");
            } finally {
              setIsLoading(false);
            }
          }
        );

        return () => setupViewer();
      }
    }, [isLeader, peer.register.control, initializeMediaSource, buffer]);

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
          onError={(e) => {
            console.error("Video error:", e);
            setError("Video playback error occurred");
          }}
        />
      </Box>
    );
  })
);

MoviePlayer.propTypes = {
  roomId: PropTypes.string.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  onPlayingChange: PropTypes.func.isRequired,
};

MoviePlayer.displayName = "MoviePlayer";

export default MoviePlayer;
