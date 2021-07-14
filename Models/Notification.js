let mongoose = require('mongoose')

const Notification = new mongoose.Schema({
  from:String,
  to:String,
  message:String,
  type:String,
  eventID:String,
  seen:Boolean,
  catered:Boolean,
  volunteerId:String
},{timestamps:true});

module.exports = mongoose.model('Notification',Notification)
