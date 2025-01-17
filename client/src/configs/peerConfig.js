export const RTC_CONFIG = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
      },
    ],
  };
  
  export const ControlMessageTypes = {
    MOVIE_MODE_ISACTIVE: 'MOVIE_MODE_ISACTIVE',
    MOVIE_ISLOADED: 'MOVIE_LOADED',
    MOVIE_READY: 'MOVIE_READY'  ,
    MOVIE_ISPLAYING: 'MOVIE_ISPLAYING',
    MOVIE_SEEK: 'MOVIE_SEEK', 
    MOVIE_BUFFER_LOW: 'MOVIE_BUFFER_LOW', 
    MOVIE_ERROR: 'MOVIE_ERROR',        
  };

  export const ChatMessageTypes = {
    MESSAGE: 'MESSAGE',           // Regular chat message
    USER_TYPING: 'USER_TYPING',  // User is typing indicator
    USER_SEEN: 'USER_SEEN',      // Message seen status
  };

  export const MovieMessageTypes = {
    CHUNK: 'CHUNK',              // Only raw movie data chunks
  };

 