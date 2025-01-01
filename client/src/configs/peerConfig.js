export const RTC_CONFIG = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
      },
    ],
  };
  
  export const ControlMessageTypes = {
    MOVIE_ISPLAYING: 'MOVIE_ISPLAYING',
    MOVIE_SEEK: 'MOVIE_SEEK',
    MOVIE_ISLOADED: 'MOVIE_LOADED',
    MOVIE_MODE_ISACTIVE: 'MOVIE_MODE_ISACTIVE',
  };

  export const ChatMessageTypes = {
    MESSAGE: 'MESSAGE',           // Regular chat message
    USER_TYPING: 'USER_TYPING',  // User is typing indicator
    USER_SEEN: 'USER_SEEN',      // Message seen status
  };

  export const MovieMessageTypes = {
    CHUNK: 'CHUNK',              // Movie data chunk
    METADATA: 'METADATA',        // Movie file info (size, type, etc)
    BUFFER_STATUS: 'BUFFER',     // Buffering status
    ERROR: 'ERROR',              // Playback errors
    READY: 'READY'              // Ready to receive/play
  };

 