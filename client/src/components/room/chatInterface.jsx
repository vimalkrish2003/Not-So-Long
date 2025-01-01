import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Avatar,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "../../contexts/authUserContext";
import { usePeer } from "../../contexts/peerContext";
import debounce from "lodash/debounce";
import { ChatMessageTypes } from "../../configs/peerConfig";
import styles from "./chatInterface.module.css";

const ChatInterface = ({ roomId }) => {
  const { user } = useAuth();
  const { registerChatHandler, sendChat, remoteUser } = usePeer();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLocalUserTyping, setIsLocalUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Register message handlers
  useEffect(() => {
    const messageCleanup = registerChatHandler(
      ChatMessageTypes.MESSAGE,
      (payload) => {
        setMessages((prev) => [
          ...prev,
          {
            roomId,
            message: payload.content,
            sender: remoteUser.name,
            timestamp: payload.timestamp,
          },
        ]);
      }
    );

    const typingCleanup = registerChatHandler(
      ChatMessageTypes.USER_TYPING,
      (payload) => {
        setIsTyping(payload.isTyping);
      }
    );

    return () => {
      messageCleanup();
      typingCleanup();
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [registerChatHandler, roomId, remoteUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages,isTyping]);

  const notifyStoppedTyping = useCallback(
    debounce(() => {
      sendChat(ChatMessageTypes.USER_TYPING, { isTyping: false });
      setIsLocalUserTyping(false);
    }, 700),
    [sendChat]
  );

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!isLocalUserTyping) {
      setIsLocalUserTyping(true);
      sendChat(ChatMessageTypes.USER_TYPING, { isTyping: true });
    }
    notifyStoppedTyping();
  };

  const handleSend = () => {
    if (newMessage.trim()) {
      setIsLocalUserTyping(false);
      notifyStoppedTyping.cancel();
      sendChat(ChatMessageTypes.USER_TYPING, { isTyping: false });

      const messageData = {
        content: newMessage,
        timestamp: new Date().toISOString(),
      };

      sendChat(ChatMessageTypes.MESSAGE, messageData);
      setMessages((prev) => [
        ...prev,
        {
          roomId,
          message: newMessage,
          sender: user.name,
          timestamp: messageData.timestamp,
        },
      ]);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box className={styles.chatContainer}>
      <Box className={styles.chatHeader}>
        <Typography className={styles.headerText}>Room Chat</Typography>
      </Box>

      <Box className={styles.messageContainer}>
        {messages.map((msg, i) => (
          <Box
            key={i}
            className={`${styles.messageWrapper} ${
              msg.sender === user.name
                ? styles.sentMessage
                : styles.receivedMessage
            }`}
          >
            <Box className={styles.messageContent}>
              {msg.sender !== user.name && (
                <Avatar src={remoteUser?.picture} className={styles.avatar}>
                  {remoteUser?.name?.[0]}
                </Avatar>
              )}
              <Box className={styles.messageBox}>
                {msg.sender !== user.name && (
                  <Typography variant="caption" className={styles.senderName}>
                    {msg.sender}
                  </Typography>
                )}
                <Box
                  className={`${styles.message} ${
                    msg.sender === user.name ? styles.sentMessage : ""
                  }`}
                  elevation={0}
                >
                  <Typography className={styles.messageText}>
                    {msg.message}
                  </Typography>
                  <Typography variant="caption" className={styles.timestamp}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
        <div ref={messagesEndRef} />
        {isTyping && (
          <Box className={`${styles.messageWrapper} ${styles.receivedMessage}`}>
            <Box className={styles.messageContent}>
              <Avatar src={remoteUser?.picture} className={styles.avatar}>
                {remoteUser?.name?.[0]}
              </Avatar>
              <Box className={styles.messageBox}>
                <Typography variant="caption" className={styles.senderName}>
                  {remoteUser?.name}
                </Typography>
                <Box className={`${styles.message} ${styles.typingMessage}`}>
                  <Typography className={styles.messageText}>
                    <span className={styles.dotOne}>.</span>
                    <span className={styles.dotTwo}>.</span>
                    <span className={styles.dotThree}>.</span>
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
      {/* Add typing indicator here */}

      <Box className={styles.inputContainer}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={"Type a message..."}
          variant="outlined"
          size="small"
          className={styles.input}
        />
        <IconButton
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className={`${styles.sendButton} ${
            !newMessage.trim() ? styles.disabled : ""
          }`}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatInterface;
