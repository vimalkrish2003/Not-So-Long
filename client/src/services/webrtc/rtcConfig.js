export const RTC_CONFIG = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
      },
      {
        urls: ["turn:numb.viagenie.ca"],
        username: "webrtc@live.com",
        credential: "muazkh",
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    sdpSemantics: "unified-plan",
  };
  
  export const MEDIA_CONSTRAINTS = {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  };
  
  export const RECONNECTION_CONFIG = {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
  };