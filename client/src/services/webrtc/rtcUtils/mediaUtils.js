import { MEDIA_CONSTRAINTS } from "../rtcConfig";

export const initializeMediaDevices = async (setIsAudioAvailable, setIsVideoAvailable) => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudio = devices.some((device) => device.kind === "audioinput");
    const hasVideo = devices.some((device) => device.kind === "videoinput");

    setIsAudioAvailable(hasAudio);
    setIsVideoAvailable(hasVideo);

    return {
      audio: hasAudio ? MEDIA_CONSTRAINTS.audio : false,
      video: hasVideo ? MEDIA_CONSTRAINTS.video : false,
    };
  } catch (err) {
    console.error("Failed to enumerate devices:", err);
    throw err;
  }
};

export const getMediaStream = async (constraints) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    console.error("Failed to get media stream:", err);
    throw err;
  }
};