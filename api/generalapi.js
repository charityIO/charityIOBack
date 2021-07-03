let router = require("express").Router();
let { User } = require("../Models");
let bcrypt = require("bcryptjs");
let jwt = require("jsonwebtoken");
let multer = require("multer");

let uuid = require("uuid").v1;
const nodemailer = require("nodemailer");

let { UNEXPECTED_ERROR } = require("../constants");

/*
Configuring the multer middleware(parses multi-part formdata such as images,pdfs,videos) for storing
profile pictures.

Note the path is public/profileImages. All the profile pictures which we will get while the user
signs up will be stored in this folder which we can easily access then on the client side by
accessing the baseURL serverURL/profileImages/<image_name> 
*/
var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/profileImages");
	},
	filename: function (req, file, cb) {
		let [filename, ext] = file.originalname.split(".");
		req.filename = `${req.body.email}.${ext}`;
		cb(null, req.filename);
	},
});

var upload = multer({ storage: storage });

router.post("/signin", (req, res) => {
	let { email, pwd } = req.body;

	User.findOne({ email })
		.lean()
		.then((user) => {
			if (user) {
				/*Comparing the hash with the password entered. We cannot convert the hash back to 
				its original form as hashing is a one way process so we convert the password entered
				into a hash as well and then compare the hashes*/
				if (bcrypt.compareSync(pwd, user.pwd)) {
					if (user.verified) {
						/*
						Delete these two fields before sending the user to the client as the user
						should not have anything to do with these
						*/
						delete user.pwd;
						delete user.verified;
						/*
						Signing a token with the user info and the secret written in the
						.env file
						*/
						jwt.sign(user, process.env.JWT_SECRET, (err, token) => {
							/*
							Sending that token to the client in the response
							*/
							return res.send({ auth: true, user, token });
						});
					} else {
						return res.send({
							auth: false,
							msg:
								"Verify your email before signing in to your account",
							appearance: "error",
						});
					}
				} else {
					return res.send({
						auth: false,
						msg: "The password entered is incorrect",
						appearance: "error",
					});
				}
			} else {
				return res.send({
					auth: false,
					msg:
						"There is no user registered to this site with this email.",
					appearance: "error",
				});
			}
		})
		.catch((err) => {
			return res.send({
				auth: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
			});
		});
});

router.post("/signup", upload.any(), (req, res) => {
	let { fname, lname, pwd, email, role, phoneNo } = req.body;
	/*
	We would hash the password before storing it in the DB. Hashing ensures that even the person
	who owns the website and has access to the DB cannot see what actual the password is.
	*/
	var salt = bcrypt.genSaltSync(10);
	var hash = bcrypt.hashSync(pwd, salt);

	/*
	Creating a random token which we would send with the email verification email. This would be used
	to verify the user's email
	*/
	let token = uuid();
	console.log('token',token)

	/*
	Making that URL which would be sent to the user's email upon clicking the user's email will be
	verified 
	*/
	let baseURL = req.protocol + "://" + req.get("host");
	let verificationURL = `${baseURL}/verify?token=${token}`;

	/*
	req.filename is the name of the file which is being stored in public/profileImages/
	We would then use this name to access the profile image on the client
	*/
	let newUser = new User({
		fname,
		lname,
		pwd: hash,
		email,
		profileImg: req.filename,
		role,
		phoneNo,
		token,
		verified: false,
	});

	User.findOne({ email })
		.lean()
		.then((user) => {
			if (!user) {
				newUser
					.save()
					.then((user) => {
						/*
						Setting up the configuration for nodemailer which would be used to send 
						the verification email to the client

						We would use a GMAIL email for this because the setup is quite easy
						*/
						let transporter = nodemailer.createTransport({
							host: "smtp.gmail.com",
							port: 587,
							auth: {
								user: process.env.GMAIL_EMAIL,
								pass: process.env.GMAIL_PASSWORD,
							},
						});

						let myMailOptions = {
							from: process.env.GMAIL_EMAIL,
							to: email,
							subject: "Chairty.io Signup",
							html: `Click on this link to verify your account <a href="${verificationURL}">${verificationURL}</a>`,
						};

						transporter.sendMail(
							myMailOptions,
							function (error, info) {
								if (error) {
									return res.json({
										status: false,
										msg: UNEXPECTED_ERROR,
										appearance:"error",
									});
								} else {
									return res.send({
										status: true,
										msg:
											"Signup Successful. Open your email to verify your account.",
										appearance: "success",
									});
								}
							}
						);
					})
					.catch((err) => {
						return res.send({
							status: false,
							msg: UNEXPECTED_ERROR,
							appearance: "error",
						});
					});
			} else {
				return res.send({
					status: false,
					msg:
						"Sorry, A user is already registered with this email. Kindly use a different email",
					appearance: "error",
				});
			}
		})
		.catch((err) => {
			return res.send({
				status: false,
				msg: UNEXPECTED_ERROR,
				appearance: "error",
			});
		});
});

router.get("/verify", (req, res) => {
	/*
	Extracting token from query params of the URL
	*/
	let token = req.query?.token;
	if (!token) {
		return res.send({
			status: false,
			msg: "No token has been provided",
		});
	} else {
		/*
		Checking if the there is a URL with that token in the DB
		*/
		User.findOne({ token })
			.then((user) => {
				if (user) {
					/*
					There is a user
					Updating verified to true as the email has been verified
					Updating token to undefined because we do not need the token now
					*/
					User.findOneAndUpdate(
						{ token },
						{ verified: true, token: undefined }
					)
						.then(() => {
							return res.send({
								status: true,
								msg: "Your account has been verified",
							});
						})
						.catch((err) => {
							return res.send({
								status: false,
								msg: UNEXPECTED_ERROR,
								appearance: "error",
							});
						});
				} else {
					return res.send({
						status: false,
						msg: UNEXPECTED_ERROR,
						appearance: "error",
					});
				}
			})
			.catch((err) => {
				return res.send({
					status: false,
					msg: UNEXPECTED_ERROR,
					appearance: "error",
				});
			});
	}
});

module.exports = router;
