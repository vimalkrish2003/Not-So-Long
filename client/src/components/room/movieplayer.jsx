import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { socket } from '../../services/socket';
/**
 * Video quality configurations for adaptive streaming
 * Adjusts resolution and bitrate based on network conditions
 * 
 * Need to add functions:
 * handlePlayBackToggle
 * 
 */
const QUALITIES = {
  HIGH: { bitrate: 2000000, width: 1920, height: 1080 },   // Full HD
  MEDIUM: { bitrate: 1000000, width: 1280, height: 720 },  // HD
  LOW: { bitrate: 500000, width: 854, height: 480 }        // SD
};

/**
 * Buffer configuration for smooth playback
 * Controls chunk sizes and buffer thresholds
 */
const BUFFER_CONFIG = {
  MIN: 10,              // Minimum buffer size in seconds
  MAX: 30,             // Maximum buffer size in seconds
  OPTIMAL: 20,         // Target buffer size
  CHUNK_SIZE: 1024 * 1024  // 1MB chunks for efficient transfer
};

/**
 * MoviePlayer Component
 * Handles P2P video streaming with adaptive quality and buffer management
 * 
 * @param {Object} props
 * @param {string} props.roomId - Room identifier for P2P connection
 * @param {boolean} props.isPlaying - Playback state
 * @param {Function} props.onPlayingChange - Playback state change handler
 * @param {Function} props.onProgressChange - Progress update handler
 * @param {Function} props.onDurationChange - Duration change handler
 */
const MoviePlayer = ({
  roomId,
  isPlaying,
  onPlayingChange,
  onProgressChange,
  onDurationChange
}) => {
  
  // Refs for DOM elements and connection management
  const videoRef = useRef(null);           // Video element reference
  const peerConnectionRef = useRef(null);   // WebRTC peer connection
  const dataChannelRef = useRef(null);      // WebRTC data channel
  const mediaSourceRef = useRef(null);      // MediaSource for streaming
  const sourceBufferRef = useRef(null);     // SourceBuffer for chunks
  const chunksRef = useRef([]);            // Video chunk queue
  const networkQualityRef = useRef('HIGH'); // Current quality level

  // Component state
  const [isHost, setIsHost] = useState(false);      // Is this peer the host?
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [error, setError] = useState(null);         // Error state

  /**
   * Determines video quality based on network speed
   * @param {number} downlink - Network speed in Mbps
   * @returns {string} Quality level (HIGH/MEDIUM/LOW)
   */
  const determineNetworkQuality = (downlink) => {
    if (downlink >= 2.5) return 'HIGH';
    if (downlink >= 1.0) return 'MEDIUM';
    return 'LOW';
  };

  /**
   * Adjusts video frame quality based on network conditions
   * @param {VideoFrame} frame - Original video frame
   * @param {string} quality - Target quality level
   * @returns {Promise<VideoFrame>} Processed frame
   */
  const adjustFrameQuality = async (frame, quality) => {
    const config = QUALITIES[quality];
    const canvas = new OffscreenCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame, 0, 0, config.width, config.height);
    frame.close();
    return new VideoFrame(canvas, { timestamp: frame.timestamp });
  };

  /**
   * Initializes WebRTC peer connection
   * Sets up data channel and ICE candidate handling
   */
  const initializeP2PConnection = useCallback(() => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create data channel for video chunks
    dataChannelRef.current = peerConnectionRef.current.createDataChannel('movieData', {
      ordered: true,
      maxRetransmits: 3
    });

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    setupDataChannelHandlers();
  }, [roomId]);

  /**
   * Sets up handlers for WebRTC data channel events
   * Processes incoming video chunks
   */
  const setupDataChannelHandlers = () => {
    if (!dataChannelRef.current) return;

    dataChannelRef.current.onmessage = async (event) => {
      const { chunk, index } = JSON.parse(event.data);
      if (!isHost) {
        if (index === 0) initMediaSource();
        chunksRef.current.push(new Blob([chunk]));
        if (!sourceBufferRef.current?.updating) {
          await appendNextChunk();
        }
      }
    };
  };

  /**
   * Initializes MediaSource for video streaming
   * Sets up source buffer and event handlers
   */
  const initMediaSource = useCallback(() => {
    mediaSourceRef.current = new MediaSource();
    videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);

    mediaSourceRef.current.addEventListener('sourceopen', () => {
      // Create source buffer for video chunks
      sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
      );

      // Handle buffer updates
      sourceBufferRef.current.addEventListener('updateend', () => {
        if (chunksRef.current.length > 0 && !sourceBufferRef.current.updating) {
          appendNextChunk();
        }
      });

      // Handle buffer errors
      sourceBufferRef.current.addEventListener('error', (e) => {
        setError(`Buffer error: ${e.message}`);
        handleBufferError();
      });
    });
  }, []);

  /**
   * Handles buffer errors by reinitializing MediaSource
   */
  const handleBufferError = async () => {
    if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
      await sourceBufferRef.current.abort();
      initMediaSource();
    }
  };

  /**
   * Manages video buffer size
   * Removes old data and requests new chunks as needed
   */
  const manageBuffer = useCallback(() => {
    if (!sourceBufferRef.current || sourceBufferRef.current.updating) return;

    const video = videoRef.current;
    const buffered = sourceBufferRef.current.buffered;

    if (buffered.length) {
      const currentBufferSize = buffered.end(0) - video.currentTime;
      
      // Remove old buffer if too large
      if (currentBufferSize > BUFFER_CONFIG.MAX) {
        sourceBufferRef.current.remove(
          buffered.start(0), 
          video.currentTime - BUFFER_CONFIG.MIN
        );
      }

      // Request more chunks if buffer is low
      if (currentBufferSize < BUFFER_CONFIG.MIN) {
        requestNextChunks();
      }
    }
  }, []);

  /**
   * Requests next video chunks from host
   */
  const requestNextChunks = () => {
    if (isHost) return;
    socket.emit('request-chunks', { roomId });
  };

  /**
   * Appends next chunk to source buffer
   */
  const appendNextChunk = async () => {
    if (chunksRef.current.length === 0 || sourceBufferRef.current.updating) return;

    try {
      const chunk = chunksRef.current.shift();
      const arrayBuffer = await chunk.arrayBuffer();
      sourceBufferRef.current.appendBuffer(arrayBuffer);
    } catch (err) {
      console.error('Error appending chunk:', err);
      handleBufferError();
    }
  };

  /**
   * Handles file upload and streaming initialization
   * @param {File} file - Video file to stream
   */
  const handleFileUpload = useCallback(async (file) => {
    try {
      setIsLoading(true);
      setError(null);
      setIsHost(true);

      // Clean up existing MediaSource
      if (mediaSourceRef.current) {
        URL.revokeObjectURL(videoRef.current.src);
      }

      // Initialize streaming
      initMediaSource();
      initializeP2PConnection();

      // Set up video processing pipeline
      const stream = new MediaStream();
      const videoTrack = stream.getVideoTracks()[0];
      
      const processor = new MediaStreamTrackProcessor({ track: videoTrack });
      const generator = new MediaStreamTrackGenerator({ kind: 'video' });
      
      // Transform stream for quality adaptation
      const transformer = new TransformStream({
        transform: async (frame, controller) => {
          const quality = networkQualityRef.current;
          const processedFrame = await adjustFrameQuality(frame, quality);
          controller.enqueue(processedFrame);
        }
      });

      // Connect processing pipeline
      processor.readable
        .pipeThrough(transformer)
        .pipeTo(generator.writable);

      // Process and send file chunks
      const totalChunks = Math.ceil(file.size / BUFFER_CONFIG.CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(
          i * BUFFER_CONFIG.CHUNK_SIZE, 
          (i + 1) * BUFFER_CONFIG.CHUNK_SIZE
        );
        chunksRef.current.push(chunk);
        
        // Send chunk to peers
        const arrayBuffer = await chunk.arrayBuffer();
        if (dataChannelRef.current?.readyState === 'open') {
          dataChannelRef.current.send(JSON.stringify({
            chunk: arrayBuffer,
            index: i,
            total: totalChunks
          }));
        }
      }

      appendNextChunk();
    } catch (err) {
      setError('Error processing video file');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [roomId, initMediaSource, initializeP2PConnection]);

  // Monitor network quality
  useEffect(() => {
    const connection = navigator.connection;
    
    const handleNetworkChange = () => {
      const newQuality = determineNetworkQuality(connection.downlink);
      if (newQuality !== networkQualityRef.current) {
        networkQualityRef.current = newQuality;
      }
    };

    connection?.addEventListener('change', handleNetworkChange);
    return () => connection?.removeEventListener('change', handleNetworkChange);
  }, []);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      onProgressChange(Math.floor((video.currentTime / video.duration) * 100));
      manageBuffer();
      
      // Sync playback state with peers
      if (isHost) {
        socket.emit('video-state', {
          roomId,
          timestamp: video.currentTime,
          isPlaying: !video.paused
        });
      }
    };

    const handleLoadedMetadata = () => {
      onDurationChange?.(Math.floor(video.duration));
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [roomId, isHost, onProgressChange, onDurationChange, manageBuffer]);

  // Handle playback state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(err => console.error('Playback error:', err));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // Handle WebRTC cleanup
  useEffect(() => {
    socket.on('ice-candidate', ({ candidate }) => {
      peerConnectionRef.current?.addIceCandidate(candidate);
    });

    return () => {
      socket.off('ice-candidate');
      if (mediaSourceRef.current) {
        URL.revokeObjectURL(videoRef.current.src);
      }
      peerConnectionRef.current?.close();
    };
  }, []);

  return (
    <Box sx={{ 
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#000'
    }}>
      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          <CircularProgress />
        </Box>
      )}
      
      {/* Error display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ position: 'absolute', top: 16, right: 16 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        playsInline
      />
    </Box>
  );
};

export default MoviePlayer;