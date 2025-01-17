// New file: src/contexts/socketContext.jsx
import {useState, createContext, useContext, useEffect } from 'react';
import { socket,connectSocket,disconnectSocket } from '../services/socket';
import { useAuth } from './authUserContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        // Connect socket
        connectSocket();

        // Handle connection events
        const handleConnect = () => {
          console.log('Socket connected');
          setIsConnected(true);
        };

        const handleDisconnect = (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        return () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          disconnectSocket();
        };
      } catch (err) {
        console.error('Socket connection error:', err);
      }
    }
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};