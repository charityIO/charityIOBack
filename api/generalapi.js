let router = require("express").Router();
let User = require("../Models/User");
let bcrypt = require("bcryptjs");
let jwt = require("jsonwebtoken");
let multer = require("multer");

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

const UNEXPECTED_ERROR = "Sorry, Something occured unexpectedly";

router.post("/signin", (req, res) => {
	let { email, pwd } = req.body;

	User.findOne({ email })
		.lean()
		.then((user) => {
			if (user) {
				if (bcrypt.compareSync(pwd, user.pwd)) {
					delete user.pwd;
					console.log(process.env.JWT_SECRET)
					jwt.sign(user, process.env.JWT_SECRET, (err, token) => {
						console.log(err,token)
						return res.send({ auth: true, user, token });
					});
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
	var salt = bcrypt.genSaltSync(10);
	var hash = bcrypt.hashSync(pwd, salt);

	let newUser = new User({
		fname,
		lname,
		pwd: hash,
		email,
		profileImg: req.filename,
		role,
		phoneNo
	});

	User.findOne({ email })
		.lean()
		.then((user) => {
			if (!user) {
				newUser
					.save()
					.then((user) => {
						return res.send({ status: true, user });
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

module.exports = router;
