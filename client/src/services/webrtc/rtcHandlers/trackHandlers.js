export const handleRemoteTrack = (track, streams, remoteStream, remoteVideoRef) => {
  console.log("Received remote track:", track.kind);
  
  try {
    const stream = streams[0];
    if (!stream) {
      console.warn("No stream received with track");
      return;
    }

    if (remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== stream) {
        console.log("Setting new remote stream");
        remoteVideoRef.current.srcObject = stream;
        
        const playVideo = async () => {
          try {
            await remoteVideoRef.current.play();
          } catch (err) {
            if (err.name === 'NotAllowedError') {
              console.warn("Autoplay prevented - will retry on user interaction");
            } else {
              console.warn("Initial playback error:", err);
              // Retry with delay
              setTimeout(playVideo, 1000);
            }
          }
        };

        playVideo();
      }
    }

    track.onunmute = () => {
      console.log(`Track ${track.kind} unmuted`);
      if (remoteVideoRef.current?.paused) {
        remoteVideoRef.current.play().catch(console.warn);
      }
    };

    track.onended = () => {
      console.log(`Track ${track.kind} ended`);
    };

  } catch (err) {
    console.error("Error handling remote track:", err);
  }
};