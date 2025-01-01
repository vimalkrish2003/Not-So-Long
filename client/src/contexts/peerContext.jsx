import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import {
  RTC_CONFIG,
  ControlMessageTypes,
  MovieMessageTypes,
  ChatMessageTypes,
} from "../configs/peerConfig";
import { useSocket } from "./socketContext";
import { useAuth } from "../contexts/authUserContext";

const PeerContext = createContext(null);

export const PeerProvider = ({ children }) => {
  const socket = useSocket();
  const { user: localUser } = useAuth();
  const [peerConnection, setPeerConnection] = useState(null);
  const [remoteUserId, setRemoteUserId] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");

  const [controlChannel, setControlChannel] = useState(null);
  const [chatChannel, setChatChannel] = useState(null);
  const [movieChannel, setMovieChannel] = useState(null);

  const [messageHandlers] = useState({
    control: {
      [ControlMessageTypes.MOVIE_ISPLAYING]: new Set(),
      [ControlMessageTypes.MOVIE_SEEK]: new Set(),
      [ControlMessageTypes.MOVIE_ISLOADED]: new Set(),
      [ControlMessageTypes.MOVIE_MODE_ISACTIVE]: new Set(),
    },
    chat: {
      [ChatMessageTypes.MESSAGE]: new Set(),
      [ChatMessageTypes.USER_TYPING]: new Set(),
      [ChatMessageTypes.USER_SEEN]: new Set(),
    },
    movie: {
      [MovieMessageTypes.CHUNK]: new Set(),
      [MovieMessageTypes.METADATA]: new Set(),
      [MovieMessageTypes.BUFFER_STATUS]: new Set(),
      [MovieMessageTypes.ERROR]: new Set(),
      [MovieMessageTypes.READY]: new Set(),
    },
  });

  // Type-safe registration function
  const registerHandler = useCallback(
    (channelType, messageType, handler) => {
      if (!messageHandlers[channelType]) {
        console.error(`Invalid channel type: ${channelType}`);
        return;
      }

      if (!messageHandlers[channelType][messageType]) {
        console.error(
          `Invalid message type: ${messageType} for channel: ${channelType}`
        );
        return;
      }

      console.log(`Registering handler for ${channelType}:${messageType}`);
      messageHandlers[channelType][messageType].add(handler);

      return () => {
        console.log(`Unregistering handler for ${channelType}:${messageType}`);
        messageHandlers[channelType][messageType].delete(handler);
      };
    },
    [messageHandlers]
  );

  const setupChannel = useCallback(
    (channel, setChannel) => {
      channel.onopen = () => {
        console.log(`${channel.label} channel opened`);
        setChannel(channel);
      };

      channel.onclose = () => {
        console.log(`${channel.label} channel closed`);
        setChannel(null);
      };

      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (!message.type) {
            console.error("Message missing type:", message);
            return;
          }

          const handlers = messageHandlers[channel.label][message.type];
          if (!handlers) {
            console.error(`No handlers for message type: ${message.type}`);
            return;
          }

          handlers.forEach((handler) => {
            try {
              handler(message.payload);
            } catch (err) {
              console.error(
                `Error in ${channel.label}:${message.type} handler:`,
                err
              );
            }
          });
        } catch (err) {
          console.error("Error processing message:", err);
        }
      };

      channel.onerror = (error) => {
        console.error(`${channel.label} channel error:`, error);
      };
    },
    [messageHandlers]
  );

  const initializePeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Create control channel - prioritize reliability and order
    const control = pc.createDataChannel("control", {
      ordered: true,
      maxRetransmits: 3, // Quick control messages with limited retries
    });

    // Create chat channel - reliable messaging
    const chat = pc.createDataChannel("chat", {
      ordered: true,
      maxRetransmits: 5, // More retries for chat messages
    });

    // Create movie channel - optimize for throughput
    const movie = pc.createDataChannel("movie", {
      ordered: true,
      maxPacketLifeTime: 5000, // Use lifetime instead of retransmits for streaming
    });

    setupChannel(control, setControlChannel);
    setupChannel(chat, setChatChannel);
    setupChannel(movie, setMovieChannel);

    // Handle incoming data channels
    pc.ondatachannel = (event) => {
      const { channel } = event;
      console.log("Received channel:", channel.label);

      switch (channel.label) {
        case "control":
          setupChannel(channel, setControlChannel);
          break;
        case "chat":
          setupChannel(channel, setChatChannel);
          break;
        case "movie":
          setupChannel(channel, setMovieChannel);
          break;
        default:
          console.warn("Unknown channel label:", channel.label);
      }
    };

    // Log state changes
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    setPeerConnection(pc);
    return pc;
  }, [socket, setupChannel]);

  // Create and send offer
  const createOffer = async (localStream) => {
    try {
      const pc = peerConnection || initializePeerConnection();

      // Only add tracks if they haven't been added yet
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        if (!senders.find((sender) => sender.track?.id === track.id)) {
          console.log("Adding track:", track.kind);
          pc.addTrack(track, localStream);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return offer;
    } catch (err) {
      console.error("Error creating offer:", err);
      throw err;
    }
  };

  // Handle incoming offer and create answer
  const createAnswer = async (offer, localStream) => {
    try {
      const pc = peerConnection || initializePeerConnection();

      // Only add tracks if they haven't been added yet
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        if (!senders.find((sender) => sender.track?.id === track.id)) {
          console.log("Adding track:", track.kind);
          pc.addTrack(track, localStream);
        }
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      return answer;
    } catch (err) {
      console.error("Error handling offer:", err);
      throw err;
    }
  };

  // Handle incoming answer
  const handleAnswer = async (answer) => {
    try {
      if (!peerConnection) {
        console.warn("No peer connection when handling answer");
        return;
      }

      // Check for have-local-offer state specifically
      if (peerConnection.signalingState === "have-local-offer") {
        console.log("Setting remote description from answer");
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } else {
        console.log(
          "Ignoring answer in signaling state:",
          peerConnection.signalingState
        );
      }
    } catch (err) {
      console.error("Error handling answer:", err);
      throw err;
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (candidate) => {
    console.log("Handling ICE candidates");
    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error("Error handling ICE candidate:", err);
      throw err;
    }
  };

  // Add helper methods for sending data
  const sendControl = useCallback(
    (type, payload) => {
      if (!Object.values(ControlMessageTypes).includes(type)) {
        console.error(`Invalid control message type: ${type}`);
        return;
      }

      if (controlChannel?.readyState === "open") {
        const message = {
          type,
          payload,
          timestamp: Date.now(),
        };
        controlChannel.send(JSON.stringify(message));
      }
    },
    [controlChannel]
  );

  const sendChat = useCallback(
    (type, payload) => {
      if (!Object.values(ChatMessageTypes).includes(type)) {
        console.error(`Invalid chat message type: ${type}`);
        return;
      }
  
      if (chatChannel?.readyState === "open") {
        const message = {
          type,
          payload,
          timestamp: Date.now()
        };
        chatChannel.send(JSON.stringify(message));
      }
    },
    [chatChannel]
  );

  const sendMovieData = useCallback(
    (data) => {
      if (movieChannel?.readyState === "open") {
        movieChannel.send(data); // For binary data like movie chunks
      }
    },
    [movieChannel]
  );

  // In PeerContext.jsx
  useEffect(() => {
    if (!localStream) return;
    // Handle user connected
    socket.on("user-connected", async ({ user }) => {
      try {
        console.log("User connected, creating offer");
        setRemoteUser(user);
        const offer = await createOffer(localStream);
        socket.emit("offer", { offer,user :localUser });
      } catch (err) {
        console.error("Error creating offer:", err);
      }
    });

    // Handle incoming offer
    socket.on("offer", async ({ offer, from }) => {
      try {
        console.log("Received offer from:", from);
        setRemoteUser(from); // Set remote user from offer payload
        if (localStream) {
          const answer = await createAnswer(offer, localStream);
          console.log("Sending answer");
          socket.emit("answer", { answer });
        }
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    // Handle disconnect
    socket.on("user-left", ({ userId }) => {
      if (userId === remoteUser?.id) {
        console.log("Remote peer disconnected, cleaning up connection");
        setRemoteUser(null);
        if (peerConnection) {
          // Close channels gracefully
          [controlChannel, chatChannel, movieChannel].forEach((channel) => {
            if (channel?.readyState === "open") {
              channel.close();
            }
          });
          // Close peer connection
          peerConnection.close();
          setPeerConnection(null);
          setRemoteStream(null);
        }
      }
    });

    // Handle answer and ICE candidates
    socket.on("answer", ({ answer }) => handleAnswer(answer));
    socket.on("ice-candidate", ({ candidate }) =>
      handleIceCandidate(candidate)
    );

    return () => {
      socket.off("user-connected");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("user-left");
    };
  }, [socket, localStream, createOffer, createAnswer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
        setRemoteStream(null);
      }
    };
  }, [peerConnection]);

  const value = {
    peerConnection,
    remoteStream,
    remoteUser,
    connectionState,
    createOffer,
    createAnswer,
    handleAnswer,
    handleIceCandidate,
    setLocalStream,
    localStream,
    sendControl,
    sendChat,
    sendMovieData,
    controlChannel,
    chatChannel,
    movieChannel,
    registerControlHandler: useCallback(
      (type, handler) => registerHandler("control", type, handler),
      [registerHandler]
    ),
    registerChatHandler: useCallback(
      (type, handler) => registerHandler("chat", type, handler),
      [registerHandler]
    ),
    registerMovieHandler: useCallback(
      (type, handler) => registerHandler("movie", type, handler),
      [registerHandler]
    ),
  };

  return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
};

PeerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const usePeer = () => {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error("usePeer must be used within a PeerProvider");
  }
  return context;
};

export default PeerContext;
