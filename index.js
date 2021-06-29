require('dotenv').config()

let express = require('express')
let app = express()
let cors = require('cors')
let jwt = require('jsonwebtoken')
let db = require('./config/db')

app.use(cors({
	origin:true,
	credentials:true
}))
app.use(express.json())

app.use(express.static(__dirname + '/public'))

app.use('/user',(req,res,next)=>{
	let token = req.headers['authorization']
	if(token){
		jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
			if(err) return res.sendStatus(403)
			req.user = decoded
			return next()
		})
	}
	else{
		return res.sendStatus(403)
	}
})

app.use('/',(req,res,next)=>{
	console.log(`${req.path} got hit`)
	next()
})


app.use('/',require('./api/generalapi'))
app.use('/user',require('./api/userapi'))


app.listen(7000,()=>{
	console.log('Listening on port 7000')
})
