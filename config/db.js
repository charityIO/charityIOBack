const mongoose = require('mongoose');

const conn = mongoose.connect(process.env.DB_URL,{
	useUnifiedTopology: true ,
	useNewUrlParser: true
})
.then(()=>{
	console.log('Mongodb connected')
})