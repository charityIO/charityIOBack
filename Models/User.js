let mongoose = require('mongoose')

const User = new mongoose.Schema({
  fname:String,
  lname:String,
  pwd:String,
  email:String,
  phoneNo:Number,
  profileImg:String,
  role:String,
  verified:Boolean,
});

module.exports = mongoose.model('User',User)
