import { io } from 'socket.io-client';

const createSocket = () => {
  const socket = io(import.meta.env.VITE_SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
    auth: () => ({
      token: localStorage.getItem('token') // Use function to get fresh token
    }),
    transports: ['websocket']
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    if (error.message === 'Invalid token') {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
  });

  // Handle disconnections
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      setTimeout(() => {
        // Get fresh token before reconnecting
        socket.auth = {
          token: localStorage.getItem('token')
        };
        socket.connect();
      }, 1000);
    }
  });

  return socket;
};

export const socket = createSocket();

// Export connect/disconnect helpers
export const connectSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token');
  }
  socket.auth = { token };
  socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};