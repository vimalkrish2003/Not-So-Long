import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  autoConnect: false, 
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  secure: true,
  auth: (cb) => {
    cb({ token: localStorage.getItem('token') });
  }
});

socket.on('connect_error', (error) => {
  if (error.message === 'Invalid token') {
    localStorage.removeItem('token');
    window.location.href = '/';
  }
});

export default socket;