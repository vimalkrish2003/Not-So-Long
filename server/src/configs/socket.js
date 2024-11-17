const { Server } = require("socket.io");

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    });

    socket.on("offer", ({ roomId, offer }) => {
      socket.to(roomId).emit("offer", offer);
    });

    socket.on("answer", ({ roomId, answer }) => {
      socket.to(roomId).emit("answer", answer);
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      socket.to(roomId).emit("ice-candidate", candidate);
    });
    // Video synchronization events
    socket.on("video-state", ({ roomId, state, timestamp }) => {
      socket.to(roomId).emit("video-state", { state, timestamp });
    });

    socket.on("video-seek", ({ roomId, timestamp }) => {
      socket.to(roomId).emit("video-seek", { timestamp });
    });

    socket.on("chat-message", ({ roomId, message }) => {
      socket.to(roomId).emit("chat-message", message);
    });
    socket.on("video-chunk", ({ roomId, chunk, index, total }) => {
      socket.to(roomId).emit("video-chunk", { chunk, index, total });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  return io;
};

module.exports = initializeSocket;
