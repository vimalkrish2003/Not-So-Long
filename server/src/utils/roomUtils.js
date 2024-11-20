const Room=require('../models/roomModel')


const generateRoomId = () => {
    return Array.from({ length: 6 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26))
    ).join("");
  }

const roomUtils = {
  getUniqueRoomId: async (maxAttempts = 5) => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const roomId = generateRoomId();
      // Check if room exists and is active
      const existingRoom = await Room.findOne({
        roomId,
      });

      if (!existingRoom) {
        return roomId;
      }
      attempts++;
    }
    throw new Error("Failed to generate unique room ID");
  },
};


module.exports = roomUtils;