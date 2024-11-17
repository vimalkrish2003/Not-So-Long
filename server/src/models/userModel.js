const mongoose=require('mongoose');

const userSchema =new mongoose.Schema({
    googleId:{type:String,unique:true},
    email:{type:String,unique:true},
    name:String,
    picture:String,
    createdAt:{type:Date,default:Date.now},
    lastLogin:{type:Date,default:Date.now},
});


module.exports=mongoose.model('User',userSchema);