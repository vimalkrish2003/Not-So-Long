const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  host: {
    type: String, // Store googleId of host
    required: true,
    ref: "User",
  },
  participants: [
    {
      type: String, // Store googleId of participants
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 43200, //Auto Delete Room after 12 hours
  },
});

module.exports = mongoose.model("Room", roomSchema);
