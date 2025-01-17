const Room = require("../models/roomModel");

const generateRoomId = () => {
  return Array.from({ length: 6 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join("");
};

const getUniqueRoomId = async (maxAttempts = 5) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const roomId = generateRoomId();
    const existingRoom = await Room.findOne({
      roomId,
    });

    if (!existingRoom) {
      return roomId;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique room ID");
};

const roomUtils = {
  createRoom: async (userId) => {
    try {
      // Get unique room ID
      const roomId = await getUniqueRoomId();

      // Create new room
      const room = await Room.create({
        roomId,
        host: userId,
        participants: [userId],
      });

      return {
        roomId: room.roomId,
        host: room.host,
      };
    } catch (error) {
      console.error("Room creation error:", error);
      throw new Error("Failed to create room");
    }
  },
  joinRoom: async (roomId, userId) => {
    try {
      const room = await Room.findOne({ roomId });

      if (!room) {
        throw new Error("Room not found");
      }

      if (room.participants.length > 1) {
        throw new Error("Room is full");
      }

      if (room.participants.includes(userId)) {
        return {
          roomId: room.roomId,
          host: room.host,
        };
      }

      room.participants.push(userId);
      await room.save();

      return {
        roomId: room.roomId,
        host: room.host,
      };
    } catch (error) {
      console.error("Room join error:", error);
      throw error;
    }
  },
  leaveRoom: async (roomId, userId) => {
    try {
      const room = await Room.findOne({ roomId });

      if (!room) {
        throw new Error("Room not found");
      }

      room.participants = room.participants.filter(id => id !== userId);

      if (room.participants.length === 0) {
        await Room.deleteOne({ _id: room._id });
      } else {
        await room.save();
      }

      return {
        message: "Left Room Successfully",
        countRemainingParticipants: room.participants.length
      };
    } catch (error) {
      console.error("Room leave error:", error);
      throw error;
    }
  },

  checkUserInRoom: async (roomId, userId) => {
    try {
      const room = await Room.findOne({ roomId });

      if (!room) {
        throw new Error("Room not found");
      }

      return {
        isInRoom: room.participants.includes(userId),
      };
    } catch (error) {
      console.error("Room check error:", error);
      throw error;
    }
  }
};

module.exports = roomUtils;
