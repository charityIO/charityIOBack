let mongoose = require('mongoose')

const Event = new mongoose.Schema({
  name:String,
  description:String,
  zipcode:Number,
  start:Date,
  end:Date,
  image:String,
  organizer:String,
  volunteers:[String],
  numberOfVolunteersRequired:Number,
},{timestamps:true});

module.exports = mongoose.model('Event',Event)
