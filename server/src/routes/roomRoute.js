const express = require("express");
const isAuthenticated = require("../middlewares/isAuthenticated");
const Room = require("../models/roomModel");
const RoomUtils = require("../utils/roomUtils");

const router = express.Router();

//Total Room Capacity = 2 people
router.post("/create", isAuthenticated, async (req, res) => {
  try {
    const roomId = await RoomUtils.getUniqueRoomId();
    const room = await Room.create({
      roomId,
      host: req.user.userId,
      participants: [req.user.userId],
    });
    res.status(201).json({
        roomId:room.roomId,
        host:room.host,
    });
  } catch (error) {
    console.error("Room Creation Error:",error);
    res.status(500).json({message:"Failed to create room"});
  }
});


router.post("/join/:roomId",isAuthenticated,async(req,res)=>{
    try{
        const {roomId}=req.params;
        const room=await Room.findOne({
            roomId,
        });

        if(!room){
            return res.status(404).json({message:"Room not found"});
        }

        //Check if no of participants is more than 1
        if(room.participants.length>1){
            return res.status(400).json({message:"Room is full"});
        }

        if(room.participants.includes(req.user.id)){
            //Return without pushing the user to database
            return res.status(200).json({
                roomId:room.roomId,
                host:room.host,
            });
        }
        room.participants.push(req.user.userId);
        await room.save();
        // put the correct status code
        res.status(200).json({
            roomId:room.roomId,
            host:room.host,
        });
    }
    catch(error){
        console.error("Room Join Error:",error);
        res.status(500).json({message:"Failed to join room"});
    }
});

router.post("/leave/:roomId",isAuthenticated,async(req,res)=>{
    try{
        const {roomId}=req.params;
        const   room=await Room.findOne({
            roomId,
        });

        if(!room){
            return res.status(404).json({message:"Room not found"});
        }

        room.participants=room.participants.filter((id)=>id!==req.user.userId);

        if(room.participants.length===0){
            await Room.deleteOne({ _id: room._id });
        }
        else{
            await room.save();
        }
        res.status(200).json({
            message:"Left Room Successfully",
            countRemainingParticipants:room.participants.length,
        });

    }
    catch(error){
        console.error("Room Leave Error:",error);
        res.status(500).json({message:"Failed to leave room"});
    }
});

module.exports = router;
