const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Room = require('../models/roomModel');

const initializeSocket = (server) => {
  // Get allowed origins from environment variable
  const allowedOrigins = process.env.CLIENT_URLS.split(',').map(url => url.trim());

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('Authentication error');
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async (roomId) => {
      try {
        const room = await Room.findOne({ roomId });
        
        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        if (!room.participants.includes(socket.userId)) {
          socket.emit('error', 'Not authorized to join room');
          return;
        }

        socket.join(roomId);
        socket.to(roomId).emit('user-joined', socket.userId);
      } catch (error) {
        socket.emit('error', 'Failed to join room');
      }
    });

    socket.on('offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('offer', offer);
    });

    socket.on('answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('answer', answer);
    });

    socket.on('ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('ice-candidate', { candidate });
    });

    socket.on('disconnect', () => {
      // Handle cleanup
    });
  });

  return io;
};

module.exports = initializeSocket;