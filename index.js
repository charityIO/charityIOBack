/*
This is used for configuring environment variables. Environment variables are variables which 
are key to an application and you do not want a third party person to know about them.

It takes variables from a .env file(you can see it right next to index.js) and attaches them to
the global process.env object.
*/
require("dotenv").config();

let express = require("express");
let app = express();
let cors = require("cors");
let jwt = require("jsonwebtoken");
let { db } = require("./config");

/*
Middlewares

Middlewares are functions which take the incoming request from the browser, do some processing
on the request object(parsing a cookie, parsing formdata) and then forward it over to the api route 
for which the request was intended

If we use the app.use() syntax directly we are applying that middleware to all requests.
However if we specify a route as a first parameter we are applying that middleware to only requests
that include that route.
*/

/*
CORS(Cross Origin Resource Sharing)
Our client(React) and Server(Node) would be deployed on different hosts so by default, the server
would not accept requests from anywhere other than the origin(where the server is deployed)

That is why we use it so it can accept requests from our client
*/
app.use(
	cors({
		origin: true,
		credentials: true,
	})
);

/*
This middleware parses the incoming data sent as json and attaches it to req.body
*/
app.use(express.json());

/*
This middleware makes the public folder a static folder. A static folder's content can be 
accessed directly by the server URL. e.g an image in public/image.jpeg can be easily accessed
by going on the route http://serverURL/image.jpeg

This is essential in order for the images being uploaded(profile pictures, event pictures) to be
used by just using the URL/path of the image in order to display it in the client
*/
app.use(express.static(__dirname + "/public"));

/*
This is IMPORTANT. Kindly watch a tutorial on JWT Authentication with React and Node. 
You would find tons of tutorials

This middleware checks if a token is being sent to the requests starting with /user(All these 
endpoints are private routes so only authenticated users have access to them). If not, it sends
them a 404, otherwise it proceeds with the request
*/
app.use("/user", (req, res, next) => {
	let token = req.headers["authorization"];
	if (token) {
		jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
			if (err) return res.sendStatus(403);
			req.user = decoded;
			return next();
		});
	} else {
		return res.sendStatus(403);
	}
});

/*
This middleware is just for logging out to the console if a API endpoint got hit and if it
got hit then which one
*/
app.use("/", (req, res, next) => {
	console.log(`${req.path} got hit`);
	next();
});

/*
Attaches the API files with these routes.
*/
app.use("/", require("./api/generalapi"));
app.use("/user", require("./api/userapi"));

/*
The server starts listening to requests on http://localhost:7000 using this command
process.env.PORT is essential for the hosting provider where I have deployed this server(Heroku)
*/
app.listen(process.env.PORT || 7000, () => {
	console.log("Listening on port 7000");
});
