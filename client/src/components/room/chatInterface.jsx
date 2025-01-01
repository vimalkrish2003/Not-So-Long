import { useState, useRef } from "react";
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
import styles from "./chatInterface.module.css";

const ChatInterface = ({ roomId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);

  const handleSend = () => {
    if (newMessage.trim()) {
      const messageData = {
        roomId,
        message: newMessage,
        sender: user.name,
        avatar: user.picture,
        timestamp: new Date().toISOString(),
      };
      // Add message locally for UI demonstration
      setMessages(prev => [...prev, messageData]);
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
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>Chat Room</Typography>
      </Box>

      <Paper className={`${styles.messageContainer} messageContainer`}>
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
                <Avatar src={msg.avatar} className={styles.avatar}>
                  {msg.sender[0]}
                </Avatar>
              )}
              <Box>
                {msg.sender !== user.name && (
                  <Typography variant="caption" className={styles.senderName}>
                    {msg.sender}
                  </Typography>
                )}
                <Paper className={`${styles.message} message ${
                  msg.sender === user.name ? 'sentMessage' : ''
                }`}>
                  <Typography sx={{ color: '#fff' }}>{msg.message}</Typography>
                  <Typography variant="caption" className={styles.timestamp}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Paper>

      <Box className={styles.inputContainer}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
          variant="outlined"
          size="small"
          className={styles.input}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255, 255, 255, 0.5)',
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!newMessage.trim()}
          className={styles.sendButton}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatInterface;