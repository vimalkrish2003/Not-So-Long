const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Room = require("../models/roomModel");

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URLS.split(",").map((url) => url.trim()),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) throw new Error("Authentication error");

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    socket.on("join-room", async (roomId) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room || !room.participants.includes(socket.userId)) {
          socket.emit("error", "Room access denied");
          return;
        }

        await socket.join(roomId);
        socket.to(roomId).emit("user-joined", socket.userId);
      } catch (error) {
        socket.emit("error", "Failed to join room");
      }
    });

    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", offer);
    });

    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", answer);
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      if (!candidate || !candidate.candidate) {
        console.warn("Invalid ICE candidate received");
        return;
      }

      // Relay ICE candidate to other peers in room
      socket.to(roomId).emit("ice-candidate", {
        candidate: {
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid,
          candidate: candidate.candidate,
          usernameFragment: candidate.usernameFragment,
        },
      });
    });
    socket.on("connection-state", (state) => {
      socket.to(roomId).emit("peer-connection-state", {
        userId: socket.userId,
        state,
      });
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("user-left", socket.userId);
        }
      }
    });
  });

  return io;
};

module.exports = initializeSocket;
