// src/services/movieServices.js
const ChunkHeader = {
  HEADER_SIZE: 16,
  FIELDS: {
    SEQUENCE: 0,    // Uint32 (4 bytes)
    SIZE: 4,        // Uint32 (4 bytes)
    TIMESTAMP: 8,   // Float64 (8 bytes)
    FLAGS: 12       // Uint32 (4 bytes)
  }
};


export const movieServices = {
  getSupportedMimeType(file) {
    const baseType = file.type;
    const codecs = [
      'avc1.42E01E,mp4a.40.2',  // Basic H.264 + AAC
      'avc1.4D401E,mp4a.40.2',  // Main H.264 + AAC
      'avc1.64001E,mp4a.40.2',  // High H.264 + AAC
      'vp8,vorbis',             // WebM VP8 + Vorbis
      'vp9,opus'                // WebM VP9 + Opus
    ];

    for (const codec of codecs) {
      const mimeType = `${baseType}; codecs="${codec}"`;
      if (MediaSource.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    throw new Error(`No supported codec found for ${baseType}`);
  },
  initializeMediaSource: (videoElement, file, options = {}) => {
    if (!videoElement) {
      return Promise.reject(new Error("No video element"));
    }

    return new Promise((resolve, reject) => {
      try {
        const mediaSource = new MediaSource();
        let sourceBuffer = null;

        const sourceOpenHandler = () => {
          try {
            // Get supported MIME type with codec
            const mimeType = movieServices.getSupportedMimeType(file);
            sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            sourceBuffer.mode = "segments";

            // Set up handlers
            if (options.onUpdateEnd) {
              sourceBuffer.addEventListener("updateend", options.onUpdateEnd);
            }
            if (options.onUpdate) {
              sourceBuffer.addEventListener("update", options.onUpdate);
            }

            resolve({
              mediaSource,
              sourceBuffer,
              cleanup: () => {
                // Cleanup handlers
                if (options.onUpdateEnd) {
                  sourceBuffer?.removeEventListener("updateend", options.onUpdateEnd);
                }
                if (options.onUpdate) {
                  sourceBuffer?.removeEventListener("update", options.onUpdate);
                }
                mediaSource.removeEventListener("sourceopen", sourceOpenHandler);
                
                if (mediaSource.readyState === "open") {
                  sourceBuffer?.abort();
                  mediaSource.endOfStream();
                }
                if (videoElement.src) {
                  URL.revokeObjectURL(videoElement.src);
                }
              }
            });
          } catch (err) {
            console.error("Source buffer error:", err);
            reject(new Error("Failed to initialize video player"));
          }
        };

        mediaSource.addEventListener("sourceopen", sourceOpenHandler);
        videoElement.src = URL.createObjectURL(mediaSource);

      } catch (err) {
        console.error("MediaSource initialization error:", err);
        reject(new Error("Failed to initialize video player"));
      }
    });
  },
  handleBufferUpdate: (sourceBuffer, buffered, currentTime, safetyOffset = 30) => {
    if (buffered.length > 0 && currentTime - safetyOffset > buffered.start(0)) {
      sourceBuffer.remove(buffered.start(0), currentTime - safetyOffset);
    }
  },

  cleanupMediaSource: (videoElement, mediaSource, sourceBuffer) => {
    try {
      if (videoElement?.src) {
        URL.revokeObjectURL(videoElement.src);
      }
      if (sourceBuffer && mediaSource?.readyState === "open") {
        sourceBuffer.abort();
        mediaSource.endOfStream();
      }
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  },
  createChunkMessage(sequence, data, isLastChunk) {
    // Create header
    const header = new ArrayBuffer(ChunkHeader.HEADER_SIZE);
    const headerView = new DataView(header);
    
    // Write header fields
    headerView.setUint32(ChunkHeader.FIELDS.SEQUENCE, sequence);
    headerView.setUint32(ChunkHeader.FIELDS.SIZE, data.byteLength);
    headerView.setFloat64(ChunkHeader.FIELDS.TIMESTAMP, Date.now());
    headerView.setUint32(ChunkHeader.FIELDS.FLAGS, isLastChunk ? 1 : 0);

    // Combine header and chunk data
    const message = new Uint8Array(ChunkHeader.HEADER_SIZE + data.byteLength);
    message.set(new Uint8Array(header), 0);
    message.set(new Uint8Array(data), ChunkHeader.HEADER_SIZE);

    return message.buffer;
  },

  parseChunkMessage(buffer) {
    const headerView = new DataView(buffer, 0, ChunkHeader.HEADER_SIZE);
    const sequence = headerView.getUint32(ChunkHeader.FIELDS.SEQUENCE);
    const size = headerView.getUint32(ChunkHeader.FIELDS.SIZE);
    const timestamp = headerView.getFloat64(ChunkHeader.FIELDS.TIMESTAMP);
    const isLastChunk = !!headerView.getUint32(ChunkHeader.FIELDS.FLAGS);
    
    // Extract chunk data
    const data = buffer.slice(ChunkHeader.HEADER_SIZE);
    
    return {
      sequence,
      size,
      timestamp,
      isLastChunk,
      data
    };
  }
};