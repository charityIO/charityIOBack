const mongoose = require('mongoose');

/*
Establishing a connection with the MongoDB Database
*/
const conn = mongoose.connect(process.env.DB_URL,{
	useUnifiedTopology: true ,
	useNewUrlParser: true
})
.then(()=>{
	console.log('Mongodb connected')
})