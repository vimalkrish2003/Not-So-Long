const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const RoomUtils = require("../utils/roomUtils");

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

    // Room Management
    socket.on("create-room", async () => {
      try {
        const room = await RoomUtils.createRoom(socket.userId);
        socket.join(room.roomId);
        socket.emit("room-created", room);
      } catch (error) {
        socket.emit("room-error", {
          message: error.message || "Failed to create room",
        });
      }
    });

    socket.on("join-room", async ({ roomId }) => {
      try {
        const room = await RoomUtils.joinRoom(roomId, socket.userId);
        socket.join(roomId);
        socket.emit("room-joined", room);
      } catch (error) {
        socket.emit("room-error", {
          message: error.message || "Failed to join room",
        });
      }
    });

    // WebRTC Signaling
    socket.on("user-joined", async ({ roomId, user }) => {
      try {
        const { isInRoom } = await RoomUtils.checkUserInRoom(roomId, user.id);

        if (!isInRoom) {
          socket.emit("room-error", { message: "Not authorized to join room" });
          return;
        }

        // Notify others in room about new user
        socket.to(roomId).emit("user-connected", {
          user,
        });
      } catch (error) {
        socket.emit("room-error", {
          message: error.message || "Failed to process join",
        });
      }
    });

    // Handle WebRTC signaling
    socket.on("offer", ({ offer }) => {
      // Broadcast offer to others in the room
      const rooms = Array.from(socket.rooms);
      const roomId = rooms.find((room) => room !== socket.id);
      if (roomId) {
        socket.to(roomId).emit("offer", {
          offer,
          from: socket.userId,
        });
      }
    });

    socket.on("answer", ({ answer }) => {
      // Broadcast answer to others in the room
      const rooms = Array.from(socket.rooms);
      const roomId = rooms.find((room) => room !== socket.id);
      if (roomId) {
        socket.to(roomId).emit("answer", {
          answer,
          from: socket.userId,
        });
      }
    });

    socket.on("ice-candidate", ({ candidate }) => {
      // Broadcast ICE candidate to others in the room
      const rooms = Array.from(socket.rooms);
      const roomId = rooms.find((room) => room !== socket.id);
      if (roomId) {
        socket.to(roomId).emit("ice-candidate", {
          candidate,
          from: socket.userId,
        });
      }
    });

    socket.on("leave-room", async () => {
      try {
        const rooms = Array.from(socket.rooms);
        const roomId = rooms.find((room) => room !== socket.id);

        if (roomId) {
          await RoomUtils.leaveRoom(roomId, socket.userId);
          socket.leave(roomId);
          socket.to(roomId).emit("user-left", { userId: socket.userId });
        }
      } catch (error) {
        console.error(`Error leaving room:`, error);
        socket.emit("room-error", {
          message: "Failed to leave room",
        });
      }
    });

    // Handle disconnection
    socket.on("disconnecting", async () => {
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        if (roomId !== socket.id) {
          try {
            await RoomUtils.leaveRoom(roomId, socket.userId);
            socket.to(roomId).emit("user-left", { userId: socket.userId });
          } catch (error) {
            console.error(`Error leaving room ${roomId}:`, error);
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });
  });

  return io;
};

module.exports = initializeSocket;
